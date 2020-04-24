import AWS from 'aws-sdk'
import {APIGatewayProxyEvent, APIGatewayProxyResult} from 'aws-lambda';
import Websocket from './websocket';

type Event = APIGatewayProxyEvent;
type Result = Promise<APIGatewayProxyResult>;
const websocket = new Websocket();
const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });
const CONNECTIONS_TABLE_NAME = process.env.CONNECTIONS_TABLE_NAME!;

interface RouteMap {
  [key: string]: (e: Event) => Result;
}

// Route: $connect
async function connect(event: Event): Result {
  console.log(JSON.stringify(event.requestContext))
  // await dynamodb.put({
  //     TableName: CONNECTIONS_TABLE_NAME,
  //     Item: {
  //       connectionId: event.requestContext.connectionId
  //     }
  //   }).promise()
  return {statusCode: 200, body: 'Connected.'}
}

// Route: $disconnect
async function disconnect(event: Event): Result {
  // await dynamodb.delete({
  //   TableName: CONNECTIONS_TABLE_NAME,
  //   Key: {
  //     connectionId: event.requestContext.connectionId
  //   }
  // }).promise();
  return {statusCode: 200, body: 'Disconnected.'}
}

// Route: message
async function message(event: Event): Result {
  return {statusCode: 200, body: 'Message sent.'}
}

export async function handler(event: Event): Result {
  websocket.init(event);

  const routeMap: RouteMap = {
    '$connect': connect,
    '$disconnect': disconnect,
    'send': message,
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
