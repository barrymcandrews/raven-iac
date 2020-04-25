import * as cdk from '@aws-cdk/core';
import {StackProps} from '@aws-cdk/core';
import {
  CfnUserPoolClient,
  CfnUserPoolDomain,
  CfnUserPoolGroup,
  UserPool,
  VerificationEmailStyle,
} from '@aws-cdk/aws-cognito';


export class CognitoStack extends cdk.Stack {
  userPool: UserPool;
  userPoolClient: CfnUserPoolClient;

  constructor(scope: cdk.Construct, id: string, props: StackProps) {
    super(scope, id, props);

    // Cognito
    this.userPool = new UserPool(this, 'userPool', {
      selfSignUpEnabled: true,
      signInAliases: {username: true,},
      autoVerify: {email: true},
      userVerification: {
        emailStyle: VerificationEmailStyle.CODE,
        emailSubject: 'Raven Messenger - Verify your account',
        emailBody: 'Hello, Your verification code is {####}',
      }
    });

    new CfnUserPoolGroup(this, 'adminsGroup', {
      groupName: 'raven-admins',
      userPoolId: this.userPool.userPoolId,

    });

    new CfnUserPoolGroup(this, 'usersGroup', {
      groupName: 'raven-users',
      userPoolId: this.userPool.userPoolId,
    });

    const cfnUserPoolDomain = new CfnUserPoolDomain(this, 'userPoolCognitoDomain', {
      domain: 'raven-users-bmcandrews',
      userPoolId: this.userPool.userPoolId
    });

    this.userPoolClient = new CfnUserPoolClient(this, 'cognitoAppClient', {
      supportedIdentityProviders: ['COGNITO'],
      clientName: 'Web',
      allowedOAuthFlowsUserPoolClient: true,
      allowedOAuthFlows: ['code'],
      allowedOAuthScopes: ['phone', 'email', 'openid', 'profile', 'aws.cognito.signin.user.admin'],
      refreshTokenValidity: 1,
      callbackUrLs: ['https://raven.bmcandrews.com/auth/callback'],
      logoutUrLs: ['https://raven.bmcandrews.com/logout'],
      userPoolId: this.userPool.userPoolId,
      preventUserExistenceErrors: 'ENABLED',
      generateSecret: false,
    });
  }
}
