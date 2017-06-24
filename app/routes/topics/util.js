
import _ from 'lodash';
import config from 'config';
import Promise from 'bluebird';
import { USER_ROLE } from '../../constants';

/**
 * Retrieves topic from discourse
 * @param {Object} logger logging
 * @param {Object} dbTopic topic retrieved from db
 * @param {Object} authUser authenticated user
 * @param {Object} discourseClient client to invoke calls to discourse
 */
const retrieveTopic = Promise.coroutine(function* a(logger, dbTopic, authUser, discourseClient) {
  let isReadOnlyForAdmins = false;
  // attempt to retrieve discourse Topic
  let topic = null;
  try {
    topic = yield discourseClient.getTopic(dbTopic.discourseTopicId, authUser.userId.toString());
    topic.tag = dbTopic.tag;
  } catch (error) {
    logger.info(`Failed to get topic from discourse: ${dbTopic.discourseTopicId}`);
    logger.error(error);
    // check if user is admin or manager - they can view topics without being a part of the team
    if (_.intersection([USER_ROLE.TOPCODER_ADMIN, USER_ROLE.MANAGER], authUser.roles).length > 0) {
      isReadOnlyForAdmins = true;
      logger.info(`Retrieving Discourse topic for admin/manager: ${dbTopic.discourseTopicId}`);
      try {
        topic = yield discourseClient
          .getTopic(dbTopic.discourseTopicId, config.get('discourseSystemUsername'));
        topic.tag = dbTopic.tag;
      } catch (err) {
        logger.info(`Failed to get topic from discourse: ${dbTopic.discourseTopicId}`);
        logger.error(err);
        topic = null;
      }
    }
  }
  return {
    isReadOnlyForAdmins,
    topic,
  };
});

module.exports = {
  retrieveTopic,
};
