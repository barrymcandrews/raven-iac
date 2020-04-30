import {PutItemInputAttributeMap} from 'aws-sdk/clients/dynamodb';

export interface Room {
  id: string;
  name: string;
  creator: string;
}
