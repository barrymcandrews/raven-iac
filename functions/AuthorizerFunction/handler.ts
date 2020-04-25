import {APIGatewayAuthorizerResult} from 'aws-lambda';
import {APIGatewayAuthorizerResultContext} from 'aws-lambda/common/api-gateway';
import {APIGatewayRequestAuthorizerEvent} from 'aws-lambda/trigger/api-gateway-authorizer';
import {ClaimVerifyResult, verifyJwt} from './verify-jwt';
import {verifyRoom, VerifyRoomResult} from './verify-room';

type Event = APIGatewayRequestAuthorizerEvent
type Result = Promise<APIGatewayAuthorizerResult>


interface GeneratorParams {
  principalId: string;
  methodArn: string;
  context?: APIGatewayAuthorizerResultContext;
}

async function generateResult(params: GeneratorParams): Result {
  return {
    principalId: params.principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowInvoke',
          Action: 'execute-api:Invoke',
          Effect: 'ALLOW',
          Resource: params.methodArn,
        },
      ],
    },
    context: params.context,
  }
}

export async function handler(event: Event): Result {
  const token = event.queryStringParameters!.Authorizer;
  const room = event.queryStringParameters!.Room;
  console.log('TOKEN: ' + token);

  const claimResult: ClaimVerifyResult = await verifyJwt(token);
  console.log(JSON.stringify(claimResult));

  const roomResult: VerifyRoomResult = await verifyRoom(room);

  if (!claimResult.isValid || !roomResult.isValid) {
    throw new Error('Unauthorized');
  }

  return await generateResult({
    principalId: claimResult.userName,
    methodArn: event.methodArn,
    context: {
      username: claimResult.userName,
      room: room,
    }
  });
}
