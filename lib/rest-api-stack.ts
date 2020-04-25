import * as cdk from '@aws-cdk/core';
import {Aws, StackProps} from '@aws-cdk/core';
import {AuthorizationType, CfnAuthorizer, Cors, LambdaRestApi, MethodOptions} from '@aws-cdk/aws-apigateway';
import {NodejsFunction} from '@aws-cdk/aws-lambda-nodejs';
import {TablesStack} from './tables-stack';
import {CognitoStack} from './cognito-stack';

interface RestApiStackProps extends StackProps {
  tablesStack: TablesStack;
  cognitoStack: CognitoStack;
}

export class RestApiStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props: RestApiStackProps) {
    super(scope, id, props);

    // Imported Tables
    const roomsTable = props.tablesStack.roomsTable;
    const messagesTable = props.tablesStack.messagesTable;

    // Imported Cognito Constructs
    const cognitoUserPool = props.cognitoStack.userPool;

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

    const api = new LambdaRestApi(this, 'restApi', {
      handler: apiFunction,
      proxy: false,
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        statusCode: 200,
      },
    });

    const authorizer = new CfnAuthorizer(this, 'cfnAuth', {
      restApiId: api.restApiId,
      name: `${Aws.STACK_NAME}-authorizer`,
      type: 'COGNITO_USER_POOLS',
      identitySource: 'method.request.header.Authorization',
      providerArns: [cognitoUserPool.userPoolArn],
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
    const messages = room.addResource('messages');
    messages.addMethod('GET', undefined, methodOptions);
    messages.addMethod('POST', undefined, methodOptions);
  }
}
