#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { RavenIacStack } from '../lib/raven-iac-stack';

const app = new cdk.App();
new RavenIacStack(app, 'RavenIacStack');
