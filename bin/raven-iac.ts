#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import {CognitoStack} from '../lib/cognito-stack';
import {TablesStack} from '../lib/tables-stack';
import {WebsocketApiStack} from '../lib/websocket-api-stack';
import {RestApiStack} from '../lib/rest-api-stack';

const app = new cdk.App();
const stage = app.node.tryGetContext('stage')

const tablesStack = new TablesStack(app, `raven-${stage}-tables`, {
  env: {region: 'us-east-1'}
})

const cognitoStack = new CognitoStack(app, `raven-${stage}-cognito`, {
  env: {region: 'us-east-1'},
});

const websocketApiStack = new WebsocketApiStack(app, `raven-${stage}-websocket`, {
  env: {region: 'us-east-1'},
  stage: stage,
  tablesStack: tablesStack,
  cognitoStack: cognitoStack,
});

new RestApiStack(app, `raven-${stage}-rest`, {
  env: {region: 'us-east-1'},
  tablesStack: tablesStack,
  cognitoStack: cognitoStack,
  websocketApiStack: websocketApiStack
});
