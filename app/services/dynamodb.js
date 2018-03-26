const aws = require('aws-sdk');
const config = require('config');
const Promise = require('bluebird');
const { DISCOURSE_WEBHOOK_STATUS } = require('../constants');

const dynamodb = new aws.DynamoDB(config.get('aws.config'));
const dynamodbTablename = config.get('aws.dynamo.tablename');
const putItem = Promise.promisify(dynamodb.putItem.bind(dynamodb));
const updateItem = Promise.promisify(dynamodb.updateItem.bind(dynamodb));

/**
 * Save record in the dynamoddb.
 *
 * @param {Object} payload object to save in the dynamodb
 * @returns {Object} promise from save
 */
const save = payload =>
  putItem({
    Item: {
      Id: { S: payload.id.toString() },
      Payload: { S: JSON.stringify(payload) },
      Status: { S: DISCOURSE_WEBHOOK_STATUS.PENDING },
    },
    ReturnConsumedCapacity: 'TOTAL',
    TableName: dynamodbTablename,
  });

/**
 * Update status of the entry in dynamodb.
 *
 * @param {String} id used to find records in dynamodb
 * @param {String} status to update on the dynamodb record
 * @returns {Object} promise from the update
 */
const updateStatus = (id, status) => {
  const payload = {
    ExpressionAttributeNames: { '#S': 'Status' },
    ExpressionAttributeValues: { ':s': { S: status } },
    Key: { Id: { S: id.toString() } },
    ReturnValues: 'ALL_NEW',
    TableName: dynamodbTablename,
    UpdateExpression: 'SET #S = :s',
  };

  return updateItem(payload);
};

module.exports = {
  save,
  updateStatus,
};
