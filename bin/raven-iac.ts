#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { RavenStack } from '../lib/raven-stack';
import {RavenWebsocketStack} from '../lib/raven-websocket-stack';
import {RavenTablesStack} from '../lib/raven-tables-stack';

const app = new cdk.App();

const tablesStack = new RavenTablesStack(app, 'ravenTablesStack-prod', {
  env: {region: 'us-east-1'},
  stage: 'prod',
})

const ravenStack = new RavenStack(app, 'ravenStack-prod', {
  env: {region: 'us-east-1'},
  stage: 'prod',
  tablesStack: tablesStack,
});
ravenStack.addDependency(tablesStack);

const ravenWebsocketStack = new RavenWebsocketStack(app, 'ravenWebsocketStack-prod', {
  env: {region: 'us-east-1'},
  stage: 'prod',
  tablesStack: tablesStack,
  ravenStack: ravenStack,
});
ravenWebsocketStack.addDependency(ravenStack);
ravenWebsocketStack.addDependency(tablesStack);
