import * as cdk from '@aws-cdk/core';
import {MessagesTable, RoomsTable} from './tables';
import {
  CfnUserPoolClient,
  CfnUserPoolDomain,
  CfnUserPoolGroup,
  UserPool,
} from '@aws-cdk/aws-cognito';
import {AuthorizationType, CfnAuthorizer, Cors, LambdaRestApi, MethodOptions} from '@aws-cdk/aws-apigateway';
import {NodejsFunction} from '@aws-cdk/aws-lambda-nodejs';


export class RavenStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const roomsTable = new RoomsTable(this, 'RoomsTable');
    const messagesTable = new MessagesTable(this, 'MessagesTable');


    // Cognito
    const ravenUserPool = new UserPool(this, 'RavenUserPool', {
      selfSignUpEnabled: true,
      signInAliases: {
        username: true,
      },
    });

    new CfnUserPoolGroup(this, 'AdminsGroup', {
      groupName: 'raven-admins',
      userPoolId: ravenUserPool.userPoolId,

    });

    new CfnUserPoolGroup(this, 'UsersGroup', {
      groupName: 'raven-users',
      userPoolId: ravenUserPool.userPoolId,
    });

    const cfnUserPoolDomain = new CfnUserPoolDomain(this, 'RavenUserPoolCognitoDomain', {
      domain: 'raven-users-bmcandrews',
      userPoolId: ravenUserPool.userPoolId
    });

    const ravenUserPoolClient = new CfnUserPoolClient(this, 'CognitoAppClient', {
      supportedIdentityProviders: ['COGNITO'],
      clientName: 'Web',
      allowedOAuthFlowsUserPoolClient: true,
      allowedOAuthFlows: ['code'],
      allowedOAuthScopes: ['phone', 'email', 'openid', 'profile', 'aws.cognito.signin.user.admin'],
      refreshTokenValidity: 1,
      callbackUrLs: ['https://raven.bmcandrews.com/auth/callback'],
      logoutUrLs: ['https://raven.bmcandrews.com/logout'],
      userPoolId: ravenUserPool.userPoolId,
      preventUserExistenceErrors: 'ENABLED',
      generateSecret: false,
    });


    // Rest API
    const apiFunction = new NodejsFunction(this, 'apiFunction', {
      entry: 'functions/RestApiFunction/api.ts',
      handler: 'handler',
      environment: {
        ROOMS_TABLE_NAME: roomsTable.tableName,
        MESSAGES_TABLE_NAME: messagesTable.tableName,
      }
    });
    roomsTable.grantFullAccess(apiFunction);
    messagesTable.grantFullAccess(apiFunction);

    const api = new LambdaRestApi(this, 'RavenApi', {
      handler: apiFunction,
      proxy: false,
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        statusCode: 200,
      }
    });

    const authorizer = new CfnAuthorizer(this, 'cfnAuth', {
      restApiId: api.restApiId,
      name: 'RavenAPIAuthorizer',
      type: 'COGNITO_USER_POOLS',
      identitySource: 'method.request.header.Authorization',
      providerArns: [ravenUserPool.userPoolArn],
    });

    const methodOptions: MethodOptions = {
      authorizationType: AuthorizationType.COGNITO,
      authorizer: {
        authorizerId: authorizer.ref
      }
    };

    // API Definition
    // /v1
    const version = api.root.addResource('v1');

    // /v1/rooms
    const rooms = version.addResource('rooms');
    rooms.addMethod('GET', undefined, methodOptions);
    rooms.addMethod('POST', undefined, methodOptions);

    // /v1/rooms/{id}
    const room = rooms.addResource('{room_id}');
    room.addMethod('GET', undefined, methodOptions);
    room.addMethod('DELETE', undefined, methodOptions);

    // /v1/rooms/{id}/messages
    const  messages = room.addResource('messages');
    messages.addMethod('GET', undefined, methodOptions);
    messages.addMethod('POST', undefined, methodOptions);


    // Websocket API
    const websocketFunction = new NodejsFunction(this, 'websocketFunction', {
      entry: 'functions/WebsocketFunction/handler.ts',
      handler: 'handler',
      environment: {
        ROOMS_TABLE_NAME: roomsTable.tableName,
        MESSAGES_TABLE_NAME: messagesTable.tableName,
      }
    });
  }
}
