import {v5 as uuidv5} from 'uuid';
import AWS from 'aws-sdk';
import {DocumentClient} from 'aws-sdk/lib/dynamodb/document_client';
import GetItemOutput = DocumentClient.GetItemOutput;

const UUID_NAMESPACE = '031548bd-10e5-460f-89d4-915896e06f65';
const dynamodb = new AWS.DynamoDB.DocumentClient({ apiVersion: '2012-08-10', region: process.env.AWS_REGION });

export interface VerifyRoomResult {
  isValid: boolean;
  error?: string;
}

export async function verifyRoom(roomName: string): Promise<VerifyRoomResult> {
  const id = uuidv5(roomName, UUID_NAMESPACE);

  try {
    const data: GetItemOutput = await dynamodb.get({
      TableName: process.env.ROOMS_TABLE_NAME!,
      Key: {id: id},
    }).promise()

    if (!('Item' in data)) {
      throw new Error('room does not exist');
    }

    return {isValid: true};
  } catch (error) {
    console.log('room error: ' + JSON.stringify(error));
    return {isValid: false, error: error};
  }
}
