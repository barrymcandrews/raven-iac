import {APIGatewayProxyEvent} from 'aws-lambda';
import ApiGatewayManagementApi from 'aws-sdk/clients/apigatewaymanagementapi';
import AWS from 'aws-sdk';

export interface Body {
  action: 'message'|'$connect'|'$disconnect'|'$default';
  message?: string;
  roomName?: string;
  timeSent?: number;
  sender?: string;
}

export default class Websocket {
  apiGatewayManagementApi: ApiGatewayManagementApi;

  constructor(endpoint: string) {
    this.apiGatewayManagementApi = new AWS.ApiGatewayManagementApi({
      apiVersion: '2018-11-29',
      endpoint: endpoint
    });
  }

  async write(connectionId: string, body: Body): Promise<{$response: AWS.Response<{}, AWS.AWSError>}> {
    return this.apiGatewayManagementApi.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(body),
    }).promise();
  }
}
