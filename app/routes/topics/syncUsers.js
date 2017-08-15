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
          const topicPromises = dbTopics.map(dbTopic => discourseClient
            .getTopic(dbTopic.discourseTopicId, DISCOURSE_SYSTEM_USERNAME));
          const topics = yield Promise.all(topicPromises);

          // Compare project users and topic users
          const allUsersToAdd = {};
          const removeAccessPromises = [];
          _.each(topics, (topic) => {
            const topicId = topic.id;
            const topicUsers = _.map(topic.details.allowed_users, 'username');

            const usersToAdd = _.difference(users, topicUsers);
            const usersToRemove = _.difference(topicUsers, users);

            _.each(usersToAdd, (userId) => {
              if (!allUsersToAdd[userId]) {
                allUsersToAdd[userId] = [topicId];
              } else {
                allUsersToAdd[userId].push(topicId);
              }
            });

            _.each(usersToRemove, (userId) => {
              logger.info(`Remove user (${userId}) from topic ${topicId}`);
              removeAccessPromises.push(discourseClient.removeAccess(userId, topicId));
            });
          });

          // Remove users access
          yield Promise.all(removeAccessPromises);

          // Ensure users exist in discourse (create if necessary)
          const userExistsPromises = [];
          _.each(_.keys(allUsersToAdd), (userId) => {
            userExistsPromises.push(helper.getUserOrProvision(userId));
          });
          yield Promise.all(userExistsPromises);

          // Add users access
          const addAccessPromises = [];
          _.each(_.keys(allUsersToAdd), (userId) => {
            _.each(allUsersToAdd[userId], (topicId) => {
              logger.info(`Add user (${userId}) to topic ${topicId}`);
              addAccessPromises.push(discourseClient.grantAccess(userId, topicId));
            });
          });
          yield Promise.all(addAccessPromises);

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
