import * as cdk from '@aws-cdk/core';
import {Aws, CfnOutput, StackProps} from '@aws-cdk/core';
import {NodejsFunction} from '@aws-cdk/aws-lambda-nodejs';
import {Effect, PolicyStatement, ServicePrincipal} from '@aws-cdk/aws-iam';
import {CfnApi, CfnAuthorizer, CfnDeployment, CfnIntegration, CfnRoute, CfnStage} from '@aws-cdk/aws-apigatewayv2';
import {RavenTablesStack} from './raven-tables-stack';

interface RavenWebsocketStackProps extends StackProps {
  stage: string;
  tablesStack: RavenTablesStack;
}

export class RavenWebsocketStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: RavenWebsocketStackProps) {
    super(scope, id, props);

    const connectionsTable = props.tablesStack.connectionsTable

    const websocketApi = new CfnApi(this, 'websocketApi', {
      name: `ravenWebsocketApi-${props.stage}`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    const websocketFunction = new NodejsFunction(this, 'websocketFunction', {
      entry: 'functions/WebsocketFunction/handler.ts',
      handler: 'handler',
      sourceMaps: true,
      environment: {
        CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
      },
    });
    connectionsTable.grantFullAccess(websocketFunction);
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

    const authorizerFunction = new NodejsFunction(this, 'websocketAuthorizerFunction', {
      entry: 'functions/AuthorizerFunction/handler.ts',
      handler: 'handler',
      sourceMaps: true,
      environment: {
        COGNITO_POOL_ID: 'us-east-1_5Pjtpk3Ui'
      },
    });
    authorizerFunction.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'));

    const websocketAuthorizer = new CfnAuthorizer(this, 'websocketAuthorizer', {
      apiId: websocketApi.ref,
      name: 'websocketAuthorizer',
      authorizerType: 'REQUEST',
      identitySource: ['route.request.querystring.Authorizer'],
      authorizerUri: `arn:aws:apigateway:${Aws.REGION}:lambda:path/2015-03-31/functions/${authorizerFunction.functionArn}/invocations`,
    });

    const connectRoute = new CfnRoute(this, 'connectRoute', {
      apiId: websocketApi.ref,
      routeKey: '$connect',
      authorizationType: 'CUSTOM',
      operationName: 'ConnectRoute',
      target: 'integrations/' + websocketIntegration.ref,
      authorizerId: websocketAuthorizer.ref,
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

    new CfnOutput(this, 'websocketUriOutput', {
      value: 'wss://' + websocketApi.ref + '.execute-api.' + Aws.REGION + '.amazonaws.com/' + webocketStage.ref,
      description: 'ApiGatewayWebsocket URL'
    });
  }
}
