import {APIGatewayAuthorizerResult, Context} from "aws-lambda";
import {APIGatewayAuthorizerResultContext} from "aws-lambda/common/api-gateway";
import {APIGatewayRequestAuthorizerEvent} from "aws-lambda/trigger/api-gateway-authorizer";

type Event = APIGatewayRequestAuthorizerEvent
type Result = Promise<APIGatewayAuthorizerResult>

enum Effect {
  ALLOW = 'ALLOW',
  DENY = 'DENY'
}

interface GeneratorParams {
  principalId: string;
  effect: Effect;
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
          Effect: params.effect,
          Resource: params.methodArn,
        },
      ],
    },
    context: params.context,
  }
}

export async function handler(event: Event, context: Context): Result {
  const token = event.queryStringParameters!.Authorizer;
  console.log('TOKEN: ' + token);
  // const result: ClaimVerifyResult = await verifyJwt(token);
  return await generateResult({
    principalId: 'me',
    effect: Effect.ALLOW,
    methodArn: event.methodArn,
    context: {
      username: 'me'
    }
  });
}

  // if (result.isValid) {
  //   return await generateResult({
  //     principalId: result.userName,
  //     effect: Effect.ALLOW,
  //     methodArn: event.methodArn,
  //     context: {
  //       username: result.userName
  //     }
  //   });
  // } else {
  //   return await generateResult({
  //     principalId: '$unknown',
  //     effect: Effect.DENY,
  //     methodArn: event.methodArn,
  //     context: {
  //       reason: result.error
  //     }
  //   });
//   }
// }
