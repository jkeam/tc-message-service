const aws = require('aws-sdk');
const config = require('config');
const Promise = require('bluebird');
const { DISCOURSE_WEBHOOK_STATUS } = require('../constants');

let adapter = null;
let tableName = null;

/*
*  Lazily instantiate the dynamodb adapter.
*/
const getSingleton = () => {
  if (!adapter) {
    tableName = config.get('aws.dynamodb.discourseWebhookLogsTable');

    const dynamodb = new aws.DynamoDB(config.get('aws.config'));
    const putItem = Promise.promisify(dynamodb.putItem.bind(dynamodb));
    const updateItem = Promise.promisify(dynamodb.updateItem.bind(dynamodb));
    const query = Promise.promisify(dynamodb.query.bind(dynamodb));
    const getItem = Promise.promisify(dynamodb.getItem.bind(dynamodb));

    const find = (id) => {
      const payload = {
        Key: {
          Id: {
            S: id.toString(),
          },
        },
        TableName: tableName,
      };
      return getItem(payload);
    };

    const save = ({ id, topicId, type, payload }) =>
      putItem({
        Item: {
          Id: { S: id.toString() },
          TopicId: { S: topicId.toString() },
          Type: { S: type },
          Payload: { S: JSON.stringify(payload) },
          Status: { S: DISCOURSE_WEBHOOK_STATUS.PENDING },
          NewId: { S: ' ' },
        },
        ReturnConsumedCapacity: 'TOTAL',
        TableName: tableName,
      });

    const updateStatus = (id, status) =>
      updateItem({
        ExpressionAttributeNames: { '#S': 'Status' },
        ExpressionAttributeValues: { ':s': { S: status } },
        Key: { Id: { S: id.toString() } },
        ReturnValues: 'ALL_NEW',
        TableName: tableName,
        UpdateExpression: 'SET #S = :s',
      });

    const updateNewId = (id, newId) =>
      updateItem({
        ExpressionAttributeNames: { '#S': 'NewId' },
        ExpressionAttributeValues: { ':s': { S: newId.toString() } },
        Key: { Id: { S: id.toString() } },
        ReturnValues: 'ALL_NEW',
        TableName: tableName,
        UpdateExpression: 'SET #S = :s',
      });

    const findByTopicIdAndType = (topicId, type) => {
      const payload = {
        IndexName: 'TopicId-Type-index',
        ConsistentRead: false,
        KeyConditionExpression: '#topicId = :topicId AND #type = :type',
        ExpressionAttributeNames: {
          '#topicId': 'TopicId',
          '#type': 'Type',
        },
        ExpressionAttributeValues: {
          ':topicId': { S: topicId.toString() },
          ':type': { S: type },
        },
        TableName: tableName,
      };

      return query(payload);
    };

    adapter = {
      save,
      updateStatus,
      updateNewId,
      findByTopicIdAndType,
      find,
    };
  }
  return adapter;
};

/**
 * Save record in the dynamoddb.
 *
 * @param {String} id unique id to identify this object
 * @param {Number} topicId topic id associated with this object
 * @param {String} type type of object this is
 * @param {Object} payload object to save in the dynamodb
 * @returns {Object} promise from save
 */
const save = (id, topicId, type, payload) =>
  getSingleton().save({ id, topicId, type, payload });

/**
 * Update status of the entry in dynamodb.
 *
 * @param {String} id used to find records in dynamodb
 * @param {String} status to update on the dynamodb record
 * @returns {Object} promise from the update
 */
const updateStatus = (id, status) =>
  getSingleton().updateStatus(id, status);

/**
 * Update status of the entry in dynamodb.
 *
 * @param {String} id used to find records in dynamodb
 * @param {String} newId new id stored in postgres
 * @returns {Object} promise from the update
 */
const updateNewId = (id, newId) =>
  getSingleton().updateNewId(id, newId);

/**
 * Find elements in dynamodb by topic id and type.
 *
 * @param {Number} topicId topic id used to find the elements
 * @param {String} type object type to find
 * @returns {Object} promise from the find
 */
const findByTopicIdAndType = (topicId, type) =>
  getSingleton().findByTopicIdAndType(topicId, type);

/**
 * Find element in dynamodb by id.  Returns the raw dynamo data.
 *
 * @param {Number} id to find the element
 * @returns {Object} promise from the find
 */
const findById = id => getSingleton().find(id);

/**
 * Find element in dynamodb by id.  Then will parse the payload and return the object.
 *
 * @param {Number} id to find the element
 * @returns {Object} promise from the find
 */
const findPayloadById = id =>
  new Promise((resolve) => {
    findById(id).then((item) => {
      if (item && item.Item && item.Item.Payload && item.Item.Payload.S) {
        try {
          const existing = JSON.parse(item.Item.Payload.S);
          resolve(existing);
        } catch (e) {
          resolve(null);
        }
      }
      resolve(null);
    }).catch(() => {
      resolve(null);
    });
  });

/**
 * Find or create the new element
 *
 * @param {String} id dynamodb id
 * @param {Number} topicId used to mark this
 * @param {String} type type of object this is
 * @param {Object} payload to store
 * @returns {Object} promise from the find
 */
const findOrCreate = (id, topicId, type, payload) =>
  new Promise((resolve, reject) => {
    findPayloadById(id).then((item) => {
      if (item) {
        resolve(item);
      } else {
        save(id, topicId, type, payload)
          .then(saved => resolve(saved))
          .catch(e => reject(e));
      }
    }).catch((e) => {
      reject(e);
    });
  });

module.exports = {
  save,
  updateStatus,
  findByTopicIdAndType,
  findOrCreate,
  findPayloadById,
  findById,
  updateNewId,
};
