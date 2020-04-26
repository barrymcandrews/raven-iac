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

  init(event: APIGatewayProxyEvent): void {
    this.apiGatewayManagementApi = new AWS.ApiGatewayManagementApi({
      apiVersion: '2018-11-29',
      endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
    });
  }

  async write(connectionId: string, body: Body): Promise<{$response: AWS.Response<{}, AWS.AWSError>}> {
    return this.apiGatewayManagementApi.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(body),
    }).promise();
  }
}
