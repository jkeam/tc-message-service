
import _ from 'lodash';
// import config from 'config';
import Promise from 'bluebird';
// import { USER_ROLE } from '../../constants';

/**
 * Retrieves topics from discourse
 * @param {Object} logger logging
 * @param {Object} dbTopics topics retrieved from db
 * @param {String} userId id of the user which should be used for fetching topic
 * @param {Object} discourseClient client to invoke calls to discourse
 */
const retrieveTopics = Promise.coroutine(function* a(logger, dbTopics, userId, discourseClient) {
  // attempt to retrieve discourse Topic
  let topics = null;
  try {
    topics = yield discourseClient.getTopics(_.map(dbTopics, t => t.discourseTopicId), userId);
    logger.debug(topics);
    _.each(topics, (t) => {
      t.tag = _.find(dbTopics, { discourseTopicId: t.id }).tag; // eslint-disable-line
    });
  } catch (error) {
    logger.info('Failed to get topics from discourse');
    logger.error(error);
    topics = null;
  }
  return topics;
});

module.exports = {
  retrieveTopics,
};
