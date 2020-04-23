import * as cdk from '@aws-cdk/core';
import {Aws, CfnOutput, StackProps} from '@aws-cdk/core';
import {NodejsFunction} from '@aws-cdk/aws-lambda-nodejs';
import {Effect, PolicyStatement, ServicePrincipal} from '@aws-cdk/aws-iam';
import {CfnApi, CfnDeployment, CfnIntegration, CfnRoute, CfnStage} from '@aws-cdk/aws-apigatewayv2';

interface RavenWebsocketStackProps extends StackProps {
  stage: string;
}

export class RavenWebsocketStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: RavenWebsocketStackProps) {
    super(scope, id, props);

    const websocketApi = new CfnApi(this, 'websocketApi', {
      name: 'ravenWebsocketApi',
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    const websocketFunction = new NodejsFunction(this, 'websocketFunction', {
      entry: 'functions/WebsocketFunction/handler.ts',
      handler: 'handler',
      sourceMaps: true,
      environment: {},
    });
    websocketFunction.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'));
    websocketFunction.addToRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['execute-api:ManageConnections'],
      resources: [`arn:aws:execute-api:${Aws.REGION}:${Aws.ACCOUNT_ID}:${websocketApi.ref}/*`],
    }));

    const websocketIntegration = new CfnIntegration(this, 'connectIntegration', {
      apiId: websocketApi.ref,
      description: 'Connect Integration',
      integrationType: 'AWS_PROXY',
      integrationUri: `arn:aws:apigateway:${Aws.REGION}:lambda:path/2015-03-31/functions/${websocketFunction.functionArn}/invocations`
    });

    const connectRoute = new CfnRoute(this, 'connectRoute', {
      apiId: websocketApi.ref,
      routeKey: '$connect',
      authorizationType: 'NONE',
      operationName: 'ConnectRoute',
      target: 'integrations/' + websocketIntegration.ref
    });

    const disconnectRoute = new CfnRoute(this, 'disconnectRoute', {
      apiId: websocketApi.ref,
      routeKey: '$disconnect',
      authorizationType: 'NONE',
      operationName: 'DisconnectRoute',
      target: 'integrations/' + websocketIntegration.ref
    });

    const messageRoute = new CfnRoute(this, 'messageRoute', {
      apiId: websocketApi.ref,
      routeKey: 'send',
      authorizationType: 'NONE',
      operationName: 'MessageRoute',
      target: 'integrations/' + websocketIntegration.ref
    });

    const defaultRoute = new CfnRoute(this, 'defaultRoute', {
      apiId: websocketApi.ref,
      routeKey: '$default',
      authorizationType: 'NONE',
      operationName: 'DefaultRoute',
      target: 'integrations/' + websocketIntegration.ref
    });

    const websocketDeployment = new CfnDeployment(this, 'websocketDeployment', {
      apiId: websocketApi.ref,
    });
    websocketDeployment.addDependsOn(connectRoute);
    websocketDeployment.addDependsOn(disconnectRoute);
    websocketDeployment.addDependsOn(messageRoute);
    websocketDeployment.addDependsOn(defaultRoute);

    const webocketStage = new CfnStage(this, 'webocketStage', {
      apiId: websocketApi.ref,
      stageName: 'prod',
      description: 'Prod Stage',
      deploymentId: websocketDeployment.ref
    });

    const websocketUriOutput = new CfnOutput(this, 'websocketUriOutput', {
      value: 'wss://' + websocketApi.ref + '.execute-api.' + Aws.REGION + '.amazonaws.com/' + webocketStage.ref,
      description: 'Websocket URL'
    });
  }
}
