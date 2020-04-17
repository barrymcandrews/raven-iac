import {AttributeType, Table} from '@aws-cdk/aws-dynamodb';
import {Construct, RemovalPolicy} from '@aws-cdk/core';

export class RoomsTable extends Table {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}

export class MessagesTable extends Table {
  constructor(scope: Construct, id: string) {
    super(scope, id, {
      partitionKey: { name: 'room', type: AttributeType.STRING },
      sortKey: { name: 'offset', type: AttributeType.NUMBER },
      removalPolicy: RemovalPolicy.DESTROY,
    });
  }
}
