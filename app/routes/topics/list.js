import HelperService from '../../services/helper';

const _ = require('lodash');
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Promise = require('bluebird');
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
    const helper = HelperService(logger, db);
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

    const userId = req.authUser.userId.toString();
    return helper.callReferenceEndpoint(req.authToken, req.id, filter.reference, filter.referenceId)
    .then((hasAccessResp) => {
      const hasAccess = helper.userHasAccessToEntity(userId, hasAccessResp, filter.reference);
      if (!hasAccess && !helper.isAdmin(req)) {
        throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
      }
      // Get topics from the Postgres database
      return db.topics_backup.findTopics(db, adapter, { filters: filter, numberOfPosts: -1, reqUserId: userId })
      .then((dbTopics) => {
        if (!dbTopics || dbTopics.length === 0) {
          // returning empty list
          return [];
        }

        // Mark all unread topics as read.
        Promise.all(dbTopics.filter(topic => !topic.read).map((topic) => {
          if (topic.posts && topic.posts.length > 0) {
            // marks first post as read for the request user
            db.post_user_stats_backup.updateUserStats(db, logger, [topic.posts[0]], userId, 'READ');
          }
          return Promise.resolve();
        }));
        // logger.debug('adapting topics', dbTopics);
        const adaptedTopics = dbTopics;
        // const adaptedTopics = adapter.adaptTopics({ topics : dbTopics });
        return adaptedTopics;
      })
      .then(result => resp.status(200).send(util.wrapResponse(req.id, result)));
    })
    .catch((error) => {
      logger.error(error);
      next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(500, 'Error fetching topics'));
    });
  };
