import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import RavenIac = require('../lib/raven-iac-stack');

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new RavenIac.RavenStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
