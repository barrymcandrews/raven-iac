import API from 'lambda-api';
import {v5 as uuidv5} from 'uuid';
import {Room} from './models';
import AWS from 'aws-sdk';
import {APIGatewayProxyEvent, APIGatewayProxyResult, Context} from 'aws-lambda';

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
  return result.Items!;
});

api.post('/rooms', async (req, resp) => {
  const room: Room = {
    name: req.body.name,
    id: uuidv5(req.body.name, UUID_NAMESPACE),
    creator: req.requestContext.authorizer!.claims['cognito:username']
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

api.get('/rooms/:name', async (req) => {
    const id = uuidv5(req.params.name!, UUID_NAMESPACE);
    return await dynamodb.get({
      TableName: ROOMS_TABLE_NAME,
      Key: {id: id},
    }).promise();
});

api.delete('/rooms/:name', async (req) => {
  const name = decodeURIComponent(req.params.name!);
  const id = uuidv5(name, UUID_NAMESPACE);
  try {
    await dynamodb.delete({
      TableName: ROOMS_TABLE_NAME,
      Key: {id: id},
    }).promise();
    return {status: 'deleted'}
  } catch (e) {
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
  return await api.run(event, context);
}
