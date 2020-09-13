import API from 'lambda-api';
import {v5 as uuidv5} from 'uuid';
import {Room} from './models';
import AWS from 'aws-sdk';
import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from 'aws-lambda';
import {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client';
import BatchWriteItemInput = DocumentClient.BatchWriteItemInput;
import QueryOutput = DocumentClient.QueryOutput;

const UUID_NAMESPACE = '031548bd-10e5-460f-89d4-915896e06f65';
const ROOMS_TABLE_NAME = process.env.ROOMS_TABLE_NAME!;
const MESSAGES_TABLE_NAME = process.env.MESSAGES_TABLE_NAME!;

const api = API({version: 'v1.0.0', base: 'v1'});
const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

api.use((req, res, next) => {
  res.cors({});
  next();
});

api.get('/rooms', async (req) => {
  const result = await dynamodb.scan({TableName: ROOMS_TABLE_NAME}).promise();
  const requester = req.requestContext.authorizer!.claims['cognito:username']
  return result.Items!.map(room => {
    return {
      ...room,
      canDelete: requester === room.creator,
    }
  });
});

api.post('/rooms', async (req, resp) => {
  if (req.body.name === '') return {status: 'Bad Request', code: 400};

  const room: Room = {
    name: req.body.name,
    id: uuidv5(req.body.name, UUID_NAMESPACE),
    creator: req.requestContext.authorizer!.claims['cognito:username'],
    status: 'ready'
  };

  try {
    await dynamodb.put({
      TableName: ROOMS_TABLE_NAME,
      Item: room,
      ConditionExpression: 'attribute_not_exists(id)'
    }).promise();

    return {status: 'OK'};

  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') {
      resp.status(409).send(JSON.stringify({
        status: 'Conflict'
      }));
    } else {
     throw err;
    }
    return resp
  }
});

api.get('/rooms/:name', async (req, resp) => {
  const id = uuidv5(req.params.name!, UUID_NAMESPACE);
  const result = await dynamodb.get({
    TableName: ROOMS_TABLE_NAME,
    Key: {id: id},
  }).promise();

  if (Object.keys(result).length === 0) {
    resp.status(404).send(JSON.stringify({
      status: 'Not Found'
    }));
    return resp;
  }

  return result;
});

api.delete('/rooms/:name', async (req) => {
  const name = decodeURIComponent(req.params.name!);
  const id = uuidv5(name, UUID_NAMESPACE);

  try {
    await dynamodb.update({
      TableName: ROOMS_TABLE_NAME,
      Key: {id: id},
      UpdateExpression: 'set #st = :s',
      ExpressionAttributeNames: {
        '#st': 'status'
      },
      ExpressionAttributeValues: {
        ':s': 'deleting'
      }
    }).promise();


    console.log(`Starting delete for: ${name}`);

    let lastEvaluatedKey = undefined;
    do {
      const queryResult: QueryOutput = await dynamodb.query({
        TableName: MESSAGES_TABLE_NAME,
        KeyConditionExpression: 'roomId = :rid',
        ExclusiveStartKey: lastEvaluatedKey,
        ExpressionAttributeValues: {
          ':rid': id,
        },
        Limit: 25,
      }).promise();
      lastEvaluatedKey = queryResult.LastEvaluatedKey;

      if (queryResult.Count! > 0) {
        const params: BatchWriteItemInput = {RequestItems: {}};
        params.RequestItems[MESSAGES_TABLE_NAME] = [];
        queryResult.Items!.forEach(item => {
          params.RequestItems[MESSAGES_TABLE_NAME].push({
            DeleteRequest: {
              Key: {
                roomId: id,
                timeSent: item['timeSent'],
              }
            }
          })
        });
        await dynamodb.batchWrite(params).promise();
      }

    } while (lastEvaluatedKey);

    console.log(`Deleting room: ${name}`);
    await dynamodb.delete({
      TableName: ROOMS_TABLE_NAME,
      Key: {id: id},
    }).promise();
    console.log(`Delete complete for: ${name}`);

    return {status: 'deleted'}
  } catch (e) {
    console.log(e);
    return e
  }
});

api.get('/rooms/:name/messages', async (req) => {
  try {
    const name = decodeURIComponent(req.params.name!);
    const id = uuidv5(name, UUID_NAMESPACE);
    console.log(req);

    const limit = Number(req.query.limit || 20) || 20;
    const before = ('before' in req.query) ? Number(req.query.before) : Date.now();
    const after = ('after' in req.query) ? Number(req.query.after) : 0;

    console.log('Params: ' + JSON.stringify({
      rid: id,
      before: before,
      after: after,
      limit: limit
    }));

    const resp = await dynamodb.query({
      TableName: MESSAGES_TABLE_NAME,
      KeyConditionExpression: 'roomId = :rid and timeSent BETWEEN :after AND :before',
      ExpressionAttributeValues: {
        ':rid': id,
        ':after': after,
        ':before': before,
      },
      ScanIndexForward: false,
      Limit: limit,
    }).promise();

    return {
      items: resp.Items!.map(m => {
        delete m['roomId'];
        m['roomName'] = name;
        return m;
      }),
      count: resp.Count,
    }
  } catch (e) {
    console.log(e);
    return e;
  }
});

export async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
  console.log(`[${event.httpMethod}][${event.path}] Invocation started.`);
  try {
    return await api.run(event, context);
  } catch (e) {
    console.log(`[${event.httpMethod}][${event.path}] Invocation not successful.`)
    console.log(e);
    return e;
  }
}
