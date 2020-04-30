import AWS from 'aws-sdk'
import {APIGatewayProxyResult, APIGatewayProxyWithLambdaAuthorizerEvent} from 'aws-lambda';
import Websocket, {Body} from './websocket';
import {AuthorizerContext} from '../AuthorizerFunction/authorizer-context';
import {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client';
import QueryOutput = DocumentClient.QueryOutput;
import AttributeMap = DocumentClient.AttributeMap;

const websocket = new Websocket();
const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;
const MESSAGES_TABLE_NAME = process.env.MESSAGES_TABLE_NAME!;

type Event = APIGatewayProxyWithLambdaAuthorizerEvent<AuthorizerContext>;
type Result = Promise<APIGatewayProxyResult>;

interface RouteMap {
  [key: string]: (e: Event) => Result;
}

enum Action {
  MESSAGE = 'message',
  CONNECT = '$connect',
  DISCONNECT = '$disconnect',
}

interface SendMessageProps {
  action: Action;
  roomId: string;
  roomName: string;
  message: string;
  timeSent: number;
  sender: string;
}

async function sendMessage(props: SendMessageProps): Promise<void> {

  const result: QueryOutput = await dynamodb.query({
    TableName: CONNECTIONS_TABLE_NAME,
    IndexName: 'roomIdIndex',
    KeyConditionExpression : 'roomId = :rid',
    ExpressionAttributeValues : {
      ':rid' : props.roomId,
    },
  }).promise();

  const data: Body = {
    action: props.action,
    roomName: props.roomName,
    timeSent: props.timeSent,
    sender: props.sender,
    message: props.message,
  }

  async function sendToConnection(item: AttributeMap): Promise<void> {
    try {
      await websocket.write(item.connectionId, data)
    } catch (error) {
      console.log('Connection Id Invalid: ' + item.connectionId);
      try {
        const resp = await dynamodb.delete({
          TableName: CONNECTIONS_TABLE_NAME,
          Key: {
            connectionId: item.connectionId
          }
        }).promise();
        console.log(resp);
      } catch (error) {
        console.log('DELETE ERROR');
        console.log(error);
      }

    }
  }

  await Promise.all(result.Items!.map(sendToConnection));

  await dynamodb.put({
    TableName: MESSAGES_TABLE_NAME,
    Item: {
      roomId: props.roomId,
      timeSent: props.timeSent,
      sender: props.sender,
      message: props.message,
    },
    ConditionExpression: 'attribute_not_exists(roomId) AND attribute_not_exists(timeSent)'
  }).promise();

  console.log(result);
}

// Route: $connect
async function connect(event: Event): Result {
  const username = event.requestContext.authorizer.username;
  await sendMessage({
    action: Action.CONNECT,
    roomId: event.requestContext.authorizer.roomId,
    roomName: event.requestContext.authorizer.roomName,
    message: `${username} has joined the server.`,
    sender:  '$server',
    timeSent: Date.now(),
  });
  console.log('Connection message sent.');

  await dynamodb.put({
    TableName: CONNECTIONS_TABLE_NAME,
    Item: {
      roomId: event.requestContext.authorizer.roomId,
      username: event.requestContext.authorizer.username,
      connectionId: event.requestContext.connectionId,
    }
  }).promise()
  console.log('Connection record created.');

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

  const username = event.requestContext.authorizer.username;
  await sendMessage({
    action: Action.DISCONNECT,
    roomId: event.requestContext.authorizer.roomId,
    roomName: event.requestContext.authorizer.roomName,
    message: `${username} has left the server.`,
    sender:  '$server',
    timeSent: Date.now(),
  });
  return {statusCode: 200, body: 'Disconnected.'}
}

// Route: message
async function message(event: Event): Result {
  const body: Body = JSON.parse(event.body!);

  if (!('message' in body)) {
    throw new Error('Invalid body. Body must have \'message\' key.');
  }

  await sendMessage({
    action: Action.MESSAGE,
    roomId: event.requestContext.authorizer.roomId,
    roomName: event.requestContext.authorizer.roomName,
    message: body.message!,
    sender:  event.requestContext.authorizer.username,
    timeSent: Date.now(),
  });

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
