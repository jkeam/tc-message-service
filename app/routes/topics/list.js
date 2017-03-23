import { retrieveTopic } from './util';

const _ = require('lodash');
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Promise = require('bluebird');
const Discourse = require('../../services/discourse');
const errors = require('common-errors');
const Joi = require('joi');
const Adapter = require('../../services/adapter');


/**
 * Handles listing of topics
 * @param {Object} db sequelize db with all models loaded
 * @return {Objet} response
 */
module.exports = db =>
  /**
   * Gets topics from Discourse for the specified entity, and in the process it does:
   *  - Checks if the user has access to the referred entity
   *  - Checks if a user exists in Discourse, if not, it creates one
   *  - Checks if a topic associated with this entity exists in Discourse, if not creates one
   *  - If the topic already exists, checks if the user has access, if not gives access
   * params: standard express parameters
   */
  (req, resp, next) => { // eslint-disable-line
    const logger = req.log;
    const discourseClient = Discourse(logger);
    const adapter = new Adapter(logger, db);

    // Validate request parameters
    Joi.assert(req.query, {
      filter: Joi.string().required(),
    });

    // Parse filter
    const parsedFilter = (req.query.filter || '').split('&');
    let filter = {};
    _(parsedFilter).each((value) => {
      const parts = value.split('=');
      if (parts.length === 2) {
        filter[parts[0]] = parts[1];
      }
    });
    // allowed filters
    filter = _.pick(filter, ['reference', 'referenceId', 'tag']);

    // Verify required filters are present
    if (!filter.reference || !filter.referenceId) {
      return next(new errors.HttpStatusError(400, 'Please provide reference and referenceId filter parameters'));
    }

    let isReadOnlyForAdmins = false;
    // Get topics from the Postgres database
    db.topics.findAll({ where: filter })
    .then((dbTopics) => {
      if (dbTopics.length === 0) {
        // returning empty list
        return resp.status(200).send(util.wrapResponse(req.id, []));
      }

      logger.info('Topics exist in pg, fetching from discourse');
      const topicPromises = dbTopics.map(dbTopic => retrieveTopic(logger, dbTopic, req.authUser, discourseClient));

      return Promise.all(topicPromises)
      .then((topicResponses) => {
        // filter null topics and sort in the  order of the last activity date descending (more recent activity first)
        let topics = _.map(topicResponses, 'topic');
        if (topics.length === 0) {
          throw new errors.HttpStatusError(404, 'Topic does not exist');
        }
        isReadOnlyForAdmins = _.every(_.map(topicResponses, 'isReadOnlyForAdmins'));
        // console.log(topics);
        topics = _.chain(topics)
          .filter(topic => topic != null)
          .orderBy(['last_posted_at'], ['desc'])
          .value();

        logger.info('returning topics');
        if (!isReadOnlyForAdmins) {
          // Mark all unread topics as read.
          Promise.all(topics.filter(topic => !topic.read).map((topic) => {
            if (topic.post_stream && topic.post_stream.posts && topic.post_stream.posts.length > 0) {
              const postIds = topic.post_stream.posts.map(post => post.post_number);
              return discourseClient.markTopicPostsRead(req.authUser.userId.toString(), topic.id, postIds);
            }
            return Promise.resolve();
          })).catch((error) => {
            logger.error('error marking topic posts read', error);
          });
        }
        logger.debug('adapting topics');
        return adapter.adaptTopics(topics);
      })
      .then(result => resp.status(200).send(util.wrapResponse(req.id, result)));
    }).catch((error) => {
      next(error);
    });
  };
