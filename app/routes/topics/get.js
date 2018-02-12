import errors from 'common-errors';
import config from 'config';
import Discourse from '../../services/discourse';
import Adapter from '../../services/adapter';
import HelperService from '../../services/helper';
import { retrieveTopics } from './util';

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
    const helper = HelperService(logger, db);
    const adapter = new Adapter(logger, db, discourseClient);
    const topicId = req.params.topicId;

    // Get topic from the Postgres database

    return db.topics.findOne({ where: { discourseTopicId: topicId }, raw: true })
      .then((dbTopic) => {
        if (!dbTopic) {
          const err = new errors.HttpStatusError(404, 'Topic does not exist');
          return next(err);
        }
        let userId = req.authUser.userId.toString();
        // check if user is admin or manager - they can view topics without being a part of the team
        if (helper.isAdmin(req)) {
          userId = config.get('discourseSystemUsername');
        }

        return retrieveTopics(logger, [dbTopic], userId, discourseClient)
          .then((topics) => {
            let topic = topics.length>0 ? topics[0] : null;
            if (!topic) {
              const err = new errors.HttpStatusError(500, 'Unable to retrieve topic from discourse');
              return next(err);
            }
            if (!helper.isAdmin(req) && !topic.read &&
              topic.posts && topic.posts.length > 0) {
              const postIds = topic.posts.map(post => post.post_number);
              return discourseClient
                .markTopicPostsRead(req.authUser.userId.toString(), topic.id, postIds)
                .then(() => {
                  logger.debug('marked read');
                  return topic;
                })
                .catch((error) => {
                  logger.error('error marking topic posts read', error);
                  // discourse just throws error in marking topics as read for non member
                  // we should not mind calling this end point once for each topic
                  // however, we may avoid this call if we make extra call to check if user has access to entity
                  return Promise.resolve(topic);
                });
            } else { // eslint-disable-line
              return Promise.resolve(topic);
            }
          })
          .then((topic) => {
            logger.info('returning topic');
            return adapter.adaptTopic({ topic, dbTopic });
          })
          .then(result => resp.status(200).send(util.wrapResponse(req.id, result)))
          .catch(err => next(err));
      })
      .catch(err => next(err));
  };
