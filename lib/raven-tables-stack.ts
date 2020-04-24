import * as cdk from '@aws-cdk/core';
import {RemovalPolicy, StackProps} from '@aws-cdk/core';
import {AttributeType, Table} from '@aws-cdk/aws-dynamodb';

interface RavenTablesStackProps extends StackProps {
  stage: string;
}

export class RavenTablesStack extends cdk.Stack {
  public roomsTable: Table;
  public messagesTable: Table;
  public connectionsTable: Table;

  constructor(scope: cdk.Construct, id: string, props?: RavenTablesStackProps) {
    super(scope, id, props);

     this.roomsTable = new Table(this, 'roomsTable',{
      partitionKey: { name: 'id', type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

     this.messagesTable = new Table(this, 'messagesTable', {
      partitionKey: { name: 'room', type: AttributeType.STRING },
      sortKey: { name: 'timeSent', type: AttributeType.NUMBER },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    this.connectionsTable = new Table(this, 'connectionsTable', {
      // partitionKey: { name: 'room', type: AttributeType.STRING },
      partitionKey: { name: 'connectionId', type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
