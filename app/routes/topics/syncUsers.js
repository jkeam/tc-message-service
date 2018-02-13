const _ = require('lodash');
const Joi = require('joi');
const Promise = require('bluebird');
const errors = require('common-errors');
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Discourse = require('../../services/discourse');
const HelperService = require('../../services/helper');

const DISCOURSE_SYSTEM_USERNAME = config.get('discourseSystemUsername');

/**
 * Handles users sync
 * @param {Object} db sequelize db with all models loaded
 * @return {Function} handler function
 */
module.exports = db =>
  /**
   * Sync project users with discourse topic users.
   *  - Verify if the user has access to the project (userHasAccessToEntity function), if the user doesn't have access return 403;
   *  - Get project users;
   *  - Get topic users;
   *  - Compare project users and topic users to add or remove users to the topic as necessary.
   * @param {Object} req express request
   * @param {Object} resp express response
   * @param {Function} next express next handler
   */
  (req, resp, next) => {
    // Validate request parameters
    Joi.assert(req.body, {
      reference: Joi.string().required().valid('project'),
      referenceId: Joi.number().required(),
      isUserLeaving: Joi.boolean(),
    });

    const reference = req.body.reference;
    const referenceId = req.body.referenceId;
    const isUserLeaving = req.body.isUserLeaving;

    const logger = req.log;
    const discourseClient = Discourse(logger);
    const helper = HelperService(logger, db);

    Promise.coroutine(function* a() {
      const endTimeMs = Date.now() + config.get('syncUsersTimeout');
      const delayMs = config.get('syncUsersRetryDelay');

      for (let i = 1; ; ++i) {
        try {
          // Verify access
          const hasAccessResp = yield helper.userHasAccessToEntity(req.authToken, req.id, reference, referenceId);
          const hasAccess = hasAccessResp[0];
          const hasAccessRespErr = hasAccessResp[2];

          if (!hasAccess) {
            if (hasAccessRespErr && (!hasAccessRespErr.response || hasAccessRespErr.response.status !== 403)) {
              // This is not 403 error, throw it and retry
              throw hasAccessRespErr;
            }
            // User does not have access, don't retry, return 403 error immediately
            return next(new errors.HttpStatusError(403, `User doesn't have access to the ${reference}`));
          }

          // Get users
          const members = _.get(hasAccessResp[1], 'members', []);
          const users = _.map(members, member => member.userId.toString());
          if (isUserLeaving) {
            // User leaves the project, remove the userId from users
            _.pull(users, `${req.authUser.userId}`);
          }
          users.push(DISCOURSE_SYSTEM_USERNAME);

          // Get topics
          const dbTopics = yield db.topics.findAll({
            where: {
              referenceId: referenceId.toString(),
              reference,
            },
            attributes: ['discourseTopicId'],
            raw: true,
          });
          let topics = yield discourseClient
                              .getTopics(dbTopics.map(dbTopic => dbTopic.discourseTopicId), DISCOURSE_SYSTEM_USERNAME);
          topics = _.orderBy(topics, ['last_posted_at'], ['asc']);

          let usersToProvision = [];
          let addUsersPairs = [];
          let removeUsersPairs = [];

          // Compare project users and topic users
          _.each(topics, (topic) => {
            const topicId = topic.id;
            const topicUsers = topic.allowed_users;

            const usersToAdd = _.difference(users, topicUsers);
            const usersToRemove = _.difference(topicUsers, users);

            usersToProvision = _.union(usersToProvision, usersToAdd);
            addUsersPairs = _.union(addUsersPairs, _.map(usersToAdd, u => [u, topicId]));
            removeUsersPairs = _.union(removeUsersPairs, _.map(usersToRemove, u => [u, topicId]));
          });
          logger.debug(`users to provision ${usersToProvision} `);
          logger.debug(`users to add ${addUsersPairs}`);
          logger.debug(`users to remove ${removeUsersPairs}`);


          yield Promise.map(usersToProvision, (userId) => {
            logger.info(`Get or provision user (${userId})`);
            return helper.getUserOrProvision(userId);
          }, { concurrency: 4 })
          .then(() => Promise.map(addUsersPairs, (pair) => {
            logger.info(`Add user (${pair[0]}) to topic ${pair[1]}`);
            return discourseClient.grantAccess(pair[0], pair[1]);
          }, { concurrency: 4 }))
          .then(() => Promise.map(removeUsersPairs, (pair) => {
            logger.info(`Remove user (${pair[0]}) from topic ${pair[1]}`);
            return discourseClient.removeAccess(pair[0], pair[1]);
          }, { concurrency: 4 }));

          return resp.status(200).send(util.wrapResponse(req.id, {}));
        } catch (e) {
          const timeLeftMs = endTimeMs - Date.now();
          if (timeLeftMs > 0) {
            logger.error(`Sync users failed. (attempt #${i}). Trying again after delay (${(timeLeftMs / 1000)} seconds\
             left until timeout).`, e);
            yield Promise.delay(delayMs);
          } else {
            throw e;
          }
        }
      }
    })().catch((error) => {
      logger.error(error);
      next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(
        error.response && error.response.status ? error.response.status : 500, 'Error sync users'));
    });
  };
