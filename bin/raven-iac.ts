#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { RavenStack } from '../lib/raven-stack';

const app = new cdk.App();
new RavenStack(app, 'RavenStack', {
  env: {region: 'us-east-1'},
});
