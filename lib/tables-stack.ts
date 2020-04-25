import * as cdk from '@aws-cdk/core';
import {RemovalPolicy, StackProps} from '@aws-cdk/core';
import {AttributeType, BillingMode, Table} from '@aws-cdk/aws-dynamodb';


export class TablesStack extends cdk.Stack {
  public roomsTable: Table;
  public messagesTable: Table;
  public connectionsTable: Table;

  constructor(scope: cdk.Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.roomsTable = new Table(this, 'roomsTable',{
      partitionKey: { name: 'id', type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    this.messagesTable = new Table(this, 'messagesTable', {
      partitionKey: { name: 'roomId', type: AttributeType.STRING },
      sortKey: { name: 'timeSent', type: AttributeType.NUMBER },
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    this.connectionsTable = new Table(this, 'connectionsTable', {
      partitionKey: { name: 'connectionId', type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      billingMode: BillingMode.PAY_PER_REQUEST,
    });
    this.connectionsTable.addGlobalSecondaryIndex({
      indexName: 'roomIdIndex',
      partitionKey: { name: 'roomId', type: AttributeType.STRING },
      sortKey: {name: 'username', type: AttributeType.STRING},
    });
  }
}
