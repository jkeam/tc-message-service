import { retrieveTopics } from './util';
import HelperService from '../../services/helper';

const _ = require('lodash');
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Promise = require('bluebird');
const Discourse = require('../../services/discourse');
const errors = require('common-errors');
const Joi = require('joi');
const Adapter = require('../../services/adapter');
const { REFERENCE_LOOKUPS } = require('../../constants');


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

    // Get topics from the Postgres database
    db.topics.findAll({ where: filter })
    .then((dbTopics) => {
      if (dbTopics.length === 0) {
        // returning empty list
        return resp.status(200).send(util.wrapResponse(req.id, []));
      }

      logger.info(`${dbTopics.length} topics exist in pg, fetching from discourse`);
      let userId = req.authUser.userId.toString();
      logger.debug(`token ${req.authToken}`);
      return helper.userHasAccessToEntity(req.authToken, req.id, filter.reference, filter.referenceId)
      .then((hasAccessResp) => {
        logger.info('Checking if user has access to identity');
        let hasAccess = hasAccessResp[0];
        if (filter.reference.toLowerCase() === REFERENCE_LOOKUPS.PROJECT) {
          const projectMembers = _.get(hasAccessResp[1], 'members', []);
            // get users list
          const isMember = _.filter(projectMembers, member => member.userId.toString() === userId).length > 0;
          logger.debug(isMember, 'isMember');
          hasAccess = isMember;
        }
        if (!hasAccess && !helper.isAdmin(req)) {
          throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
        }

        // if user does not have access but if user is admin or manager, use discourse system user to make API calls
        // - they can view topics without being a part of the team
        const usingAdminAccess = !hasAccess && helper.isAdmin(req);
        if (usingAdminAccess) {
          userId = config.get('discourseSystemUsername');
        }


        return retrieveTopics(logger, dbTopics, userId, discourseClient)
        .then((topics) => {
          logger.info(`${topics.length} topics fetched from discourse`);

          const topicsFiltered = _.chain(topics)
            .filter(topic => topic != null)
            .orderBy(['last_posted_at'], ['desc'])
            .value();

          logger.info(`${topicsFiltered.length} topics after filter`);
          if (!usingAdminAccess) {
            // Mark all unread topics as read.
            Promise.all(topicsFiltered.filter(topic => !topic.read).map((topic) => {
              if (topic.posts && topic.posts.length > 0) {
                const postIds = topic.posts.map(post => post.post_number);
                return discourseClient.markTopicPostsRead(req.authUser.userId.toString(), topic.id, postIds);
              }
              return Promise.resolve();
            })).catch((error) => {
              logger.error('error marking topic posts read', error);
            });
          }
          logger.debug('adapting topics', topicsFiltered);
          return adapter.adaptTopics({ topics: topicsFiltered, dbTopics });
        })
        .then(result => resp.status(200).send(util.wrapResponse(req.id, result)));
      });
    }).catch((error) => {
      next(error);
    });
  };
