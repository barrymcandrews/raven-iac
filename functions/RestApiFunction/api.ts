import API from 'lambda-api';
import {DynamoDB} from 'aws-sdk';
import {v5 as uuidv5} from 'uuid';
import {Room} from './models';

const UUID_NAMESPACE = '031548bd-10e5-460f-89d4-915896e06f65';
const ROOMS_TABLE_NAME = process.env.ROOMS_TABLE_NAME!;
const MESSAGES_TABLE_NAME = process.env.MESSAGES_TABLE_NAME!;

const endpoint = process.env.AWS_SAM_LOCAL ? 'http://localhost:8000' : undefined;

const api = API({version: 'v1.0.0', base: 'v1'});
const dynamoDB = new DynamoDB({endpoint: endpoint});

api.use((req, res, next) => {
  res.cors({});
  next();
});

api.get('/rooms', async (req) => {
  console.log('hello');
  const result = await dynamoDB.scan({TableName: ROOMS_TABLE_NAME}).promise();
  return result.Items!.map(Room.fromItem);
});

api.post('/rooms', async (req, resp) => {
  const room = new Room({
    name: req.body.name,
    id: uuidv5(req.body.name, UUID_NAMESPACE),
    creator: req.requestContext.authorizer!.claims['cognito:username']
  });

  try {
    await dynamoDB.putItem({
      TableName: ROOMS_TABLE_NAME,
      Item: room.toItem(),
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
    return Room.fromItem((await dynamoDB.getItem({
      TableName: ROOMS_TABLE_NAME,
      Key: {
        id: {S: id},
      }
    }).promise()).Item);
});

api.delete('/rooms/:name', async (req) => {
  const id = uuidv5(req.params.name!, UUID_NAMESPACE);
  try {
    await dynamoDB.deleteItem({
      TableName: ROOMS_TABLE_NAME,
      Key: {id: {S: id},}
    }).promise();
    return {status: 'deleted'}
  } catch (e) {
    return e
  }

});

export async function handler(event: any, context: any){
  return await api.run(event, context);
}
