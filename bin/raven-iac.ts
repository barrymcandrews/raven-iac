#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { RavenStack } from '../lib/raven-stack';
import {RavenWebsocketStack} from '../lib/raven-websocket-stack';

const app = new cdk.App();
new RavenStack(app, 'ravenStack-prod', {
  env: {region: 'us-east-1'},
  stage: 'prod',
});

new RavenWebsocketStack(app, 'ravenWebsocketStack-prod', {
  env: {region: 'us-east-1'},
  stage: 'prod',
});
