import * as cdk from '@aws-cdk/core';
import {Aws, CfnOutput, StackProps} from '@aws-cdk/core';
import {NodejsFunction} from '@aws-cdk/aws-lambda-nodejs';
import {Effect, PolicyStatement, ServicePrincipal} from '@aws-cdk/aws-iam';
import {CfnApi, CfnAuthorizer, CfnDeployment, CfnIntegration, CfnRoute, CfnStage} from '@aws-cdk/aws-apigatewayv2';
import {TablesStack} from './tables-stack';
import {CognitoStack} from './cognito-stack';

interface RavenWebsocketStackProps extends StackProps {
  stage: string;
  tablesStack: TablesStack;
  cognitoStack: CognitoStack;
}

export class WebsocketApiStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: RavenWebsocketStackProps) {
    super(scope, id, props);

    // Imported Tables
    const connectionsTable = props.tablesStack.connectionsTable;
    const messagesTable = props.tablesStack.messagesTable;
    const roomsTable = props.tablesStack.roomsTable;

    // Imported Cognito Ids
    const cognitoUserPoolId = props.cognitoStack.userPool.userPoolId;
    const cognitoUserPoolClientId = props.cognitoStack.userPoolClient.ref;

    const websocketApi = new CfnApi(this, 'websocketApi', {
      name: `${Aws.STACK_NAME}-api`,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
    });

    const websocketFunction = new NodejsFunction(this, 'websocketFunction', {
      entry: 'functions/WebsocketFunction/handler.ts',
      handler: 'handler',
      sourceMaps: true,
      environment: {
        CONNECTIONS_TABLE_NAME: connectionsTable.tableName,
        MESSAGES_TABLE_NAME: messagesTable.tableName,
        ENDPOINT: websocketApi.ref + '.execute-api.' + Aws.REGION + '.amazonaws.com/' + props.stage,
      },
    });
    connectionsTable.grantFullAccess(websocketFunction);
    messagesTable.grantFullAccess(websocketFunction);
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

    const authorizerFunction = new NodejsFunction(this, 'authorizerFunction', {
      entry: 'functions/AuthorizerFunction/handler.ts',
      handler: 'handler',
      sourceMaps: true,
      environment: {
        COGNITO_POOL_ID: cognitoUserPoolId,
        COGNITO_POOL_CLIENT_ID: cognitoUserPoolClientId,
        ROOMS_TABLE_NAME: roomsTable.tableName,
      },
    });
    authorizerFunction.grantInvoke(new ServicePrincipal('apigateway.amazonaws.com'));
    roomsTable.grantFullAccess(authorizerFunction);

    const websocketAuthorizer = new CfnAuthorizer(this, 'authorizer', {
      apiId: websocketApi.ref,
      name: `${Aws.STACK_NAME}-authorizer`,
      authorizerType: 'REQUEST',
      identitySource: [
        'route.request.querystring.Authorizer',
        'route.request.querystring.Room',
      ],
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
      routeKey: 'message',
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
      stageName: props.stage,
      description: 'Prod Stage',
      deploymentId: websocketDeployment.ref
    });

    new CfnOutput(this, 'websocketUriOutput', {
      value: 'wss://' + websocketApi.ref + '.execute-api.' + Aws.REGION + '.amazonaws.com/' + webocketStage.ref,
      description: 'ApiGatewayWebsocket URL'
    });
  }
}
