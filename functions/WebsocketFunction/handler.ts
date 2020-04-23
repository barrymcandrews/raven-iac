import AWS from 'aws-sdk'

export async function handler(event: any, context: any) {

  const route = event.requestContext.routeKey;
  console.log('ROUTE: ' + route);

  const apigwManagementApi = new AWS.ApiGatewayManagementApi({
    apiVersion: '2018-11-29',
    endpoint: event.requestContext.domainName + '/' + event.requestContext.stage
  });

  async function send(connectionId: string, data: any) {
    await apigwManagementApi.postToConnection({ ConnectionId: connectionId, Data: `Echo: ${data}` }).promise();
  }

  if (route === 'send') {
    const connectionId = event.requestContext.connectionId;
    const data = JSON.parse(event.body).body;
    console.log(event.body);

      await send(connectionId, data);
    return {statusCode: 200, body: 'Data sent.'};
  } else if (route === '$connect') {
    return {statusCode: 200, body: 'Connected.'};
  } else if (route === '$disconnect') {
    return {statusCode: 200, body: 'Disconnected.'};
  } else {
    console.log('Unhandled route.');
    return {statusCode: 500, body: 'Unhandled route.'};
  }
}
