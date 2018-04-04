const aws = require('aws-sdk');
const config = require('config');
const Promise = require('bluebird');

const dynamodb = new aws.DynamoDB(config.get('aws.config'));
const createTable = Promise.promisify(dynamodb.createTable.bind(dynamodb));

const TableName = config.get('aws.dynamodb.discourseWebhookLogsTable');

const params = {
  AttributeDefinitions: [{
    AttributeName: 'Id',
    AttributeType: 'S'
  },{
    AttributeName: 'TopicId',
    AttributeType: 'S'
  }, {
    AttributeName: 'Type',
    AttributeType: 'S'
  }],
  KeySchema: [{
    AttributeName: 'Id',
    KeyType: 'HASH'
  }],
  GlobalSecondaryIndexes: [{
    IndexName: 'TopicId-Type-index',
    KeySchema: [{
      AttributeName: 'TopicId',
      KeyType: 'HASH'
    }, {
      AttributeName: 'Type',
      KeyType: 'RANGE'
    }],
    Projection: {
      ProjectionType: 'ALL'
    },
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  }],
  ProvisionedThroughput: {
    ReadCapacityUnits: 5,
    WriteCapacityUnits: 5
  },
  TableName
};

createTable(params).then((data) => {
  console.log('Created table. Table description JSON:', JSON.stringify(data, null, 2));
}).catch((err) => {
  console.error('Unable to create table. Error JSON:', JSON.stringify(err, null, 2));
});
