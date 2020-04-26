import AWS from 'aws-sdk'
import {APIGatewayProxyResult, APIGatewayProxyWithLambdaAuthorizerEvent} from 'aws-lambda';
import Websocket, {Body} from './websocket';
import {AuthorizerContext} from '../AuthorizerFunction/authorizer-context';
import {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client';
import QueryOutput = DocumentClient.QueryOutput;

const websocket = new Websocket();
const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;
const MESSAGES_TABLE_NAME = process.env.MESSAGES_TABLE_NAME!;

type Event = APIGatewayProxyWithLambdaAuthorizerEvent<AuthorizerContext>;
type Result = Promise<APIGatewayProxyResult>;

interface RouteMap {
  [key: string]: (e: Event) => Result;
}

// Route: $connect
async function connect(event: Event): Result {
  await dynamodb.put({
      TableName: CONNECTIONS_TABLE_NAME,
      Item: {
        roomId: event.requestContext.authorizer.roomId,
        username: event.requestContext.authorizer.username,
        connectionId: event.requestContext.connectionId,
      }
    }).promise()
  return {statusCode: 200, body: 'Connected.'}
}

// Route: $disconnect
async function disconnect(event: Event): Result {
  await dynamodb.delete({
    TableName: CONNECTIONS_TABLE_NAME,
    Key: {
      connectionId: event.requestContext.connectionId
    }
  }).promise();
  return {statusCode: 200, body: 'Disconnected.'}
}

// Route: message
async function message(event: Event): Result {
  const body: Body = JSON.parse(event.body!);
  const roomId = event.requestContext.authorizer.roomId;
  const roomName = event.requestContext.authorizer.roomName;
  const sender = event.requestContext.authorizer.username;

  if (!('message' in body)) {
    throw new Error('Invalid body. Body must have \'message\' key.');
  }

  await dynamodb.put({
    TableName: MESSAGES_TABLE_NAME,
    Item: {
      roomId: roomId,
      timeSent: Date.now(),
      sender: sender,
      message: body.message,
    },
    ConditionExpression: 'attribute_not_exists(roomId) AND attribute_not_exists(timeSent)'
  }).promise();

  const result: QueryOutput = await dynamodb.query({
    TableName: CONNECTIONS_TABLE_NAME,
    IndexName: 'roomIdIndex',
    KeyConditionExpression : 'roomId = :rid',
    ExpressionAttributeValues : {
      ':rid' : roomId,
    },
  }).promise();

  console.log(result);

  const data: Body = {
    action: 'message',
    roomName: roomName,
    timeSent: Date.now(),
    sender: sender,
    message: body.message,
  }

  await Promise.all(result.Items!.map(item => {
    console.log(result);
    return websocket.write(item.connectionId, data);
  }));

  return {statusCode: 200, body: 'Messages sent.'}
}

export async function handler(event: Event): Result {
  websocket.init(event);

  const routeMap: RouteMap = {
    '$connect': connect,
    '$disconnect': disconnect,
    'message': message,
    '$default': (async () => {return  {statusCode: 200, body: 'Ok.'}}),
  }

  try {
    const route: string = event.requestContext.routeKey!;
    console.log('ROUTE: ' + route);
    return await routeMap[route](event);
  } catch (error) {
    console.log(error);
    return {statusCode: 500, body: 'Internal Error'};
  }
}
