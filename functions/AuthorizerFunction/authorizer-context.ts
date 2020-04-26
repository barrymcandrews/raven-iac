import {APIGatewayAuthorizerResultContext} from 'aws-lambda/common/api-gateway';

export interface AuthorizerContext extends APIGatewayAuthorizerResultContext {
  username: string;
  roomId: string;
  roomName: string;
}
