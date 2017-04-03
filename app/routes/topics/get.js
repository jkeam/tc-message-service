import errors from 'common-errors';
import config from 'config';

import Discourse from '../../services/discourse';
import Adapter from '../../services/adapter';
import { retrieveTopic } from './util';

const util = require('tc-core-library-js').util(config);


/**
 * Get specific topic
 * @param {Object} db sequelize db with all models loaded
 * @return {Object} response
 */
module.exports = db =>

  /**
   * Gets topic from Discourse for the specified entity, and in the process it does:
   *  - Checks if the user has access to the referred entity
   *  - Checks if a user exists in Discourse, if not, it creates one
   *  - Checks if a topic associated with this entity exists in Discourse, if not creates one
   *  - If the topic already exists, checks if the user has access, if not gives access
   * params: standard express parameters
   */
  (req, resp, next) => {
    const logger = req.log;
    const discourseClient = Discourse(logger);
    //  const helper = HelperService(logger, db);
    const adapter = new Adapter(logger, db);
    const topicId = req.params.topicId;

    // Get topic from the Postgres database

    return db.topics.findOne({ where: { discourseTopicId: topicId }, raw: true })
      .then((dbTopic) => {
        if (!dbTopic) {
          const err = new errors.HttpStatusError(404, 'Topic does not exist');
          return next(err);
        }

        return retrieveTopic(logger, dbTopic, req.authUser, discourseClient)
          .then(({ isReadOnlyForAdmins, topic }) => {
            if (!topic) {
              const err = new errors.HttpStatusError(500, 'Unable to retrieve topic from discourse');
              return next(err);
            }
            if (!isReadOnlyForAdmins && !topic.read &&
              topic.post_stream && topic.post_stream.posts && topic.post_stream.posts.length > 0) {
              const postIds = topic.post_stream.posts.map(post => post.post_number);
              return discourseClient
                .markTopicPostsRead(req.authUser.userId.toString(), topic.id, postIds)
                .then(() => {
                  logger.debug('marked read');
                  return topic;
                })
                .catch((error) => {
                  logger.error('error marking topic posts read', error);
                });
            } else { // eslint-disable-line
              return Promise.resolve(topic);
            }
          })
          .then((topic) => {
            logger.info('returning topic');
            return adapter.adaptTopics(topic, req.authToken);
          })
          .then(result => resp.status(200).send(util.wrapResponse(req.id, result)))
          .catch(err => next(err));
      })
      .catch(err => next(err));
  };
