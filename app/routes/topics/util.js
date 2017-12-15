
// import _ from 'lodash';
// import config from 'config';
import Promise from 'bluebird';
// import { USER_ROLE } from '../../constants';

/**
 * Retrieves topic from discourse
 * @param {Object} logger logging
 * @param {Object} dbTopic topic retrieved from db
 * @param {String} userId id of the user which should be used for fetching topic
 * @param {Object} discourseClient client to invoke calls to discourse
 */
const retrieveTopic = Promise.coroutine(function* a(logger, dbTopic, userId, discourseClient) {
  // attempt to retrieve discourse Topic
  let topic = null;
  try {
    topic = yield discourseClient.getTopic(dbTopic.discourseTopicId, userId);
    topic.tag = dbTopic.tag;
  } catch (error) {
    logger.info(`Failed to get topic from discourse: ${dbTopic.discourseTopicId}`);
    logger.error(error);
    topic = null;
  }
  return {
    topic,
  };
});

module.exports = {
  retrieveTopic,
};
