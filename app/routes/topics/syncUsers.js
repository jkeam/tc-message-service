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

          // ----> NOTE code from this line can be removed after we migrate to categories from private messages
          // but actually the overhead of this code is just calling db.topics.findAll in case all topics
          // are already migrated, so we can keep this code untouched until we complitely move from Discourse

          // Get topics to detect if we have sync using private message or categories/groups
          const dbTopics = yield db.topics.findAll({
            where: {
              referenceId: referenceId.toString(),
              reference,
            },
            attributes: ['discourseTopicId', 'isPrivateMessage'],
            raw: true,
          });

          const dbTopicsAsPrivates = _.filter(dbTopics, 'isPrivateMessage');
          const dbTopicsInCategory = _.reject(dbTopics, 'isPrivateMessage');

          logger.info(`Have ${dbTopicsAsPrivates.length} private message topics \
            and ${dbTopicsInCategory.length} category topics to sync users for.`);

          // if some topics are maintained as private messages, run old process of syncing for them
          if (dbTopicsAsPrivates.length > 0) {
            logger.info('Syncing users for topics using private messages...');
            let topics = yield discourseClient
              .getTopics(dbTopicsAsPrivates.map(dbTopic => dbTopic.discourseTopicId), DISCOURSE_SYSTEM_USERNAME);
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
          }

          // <---- NOTE code until here can be removed after we migrate to categories from private messages

          // if there are topics which maintained using categories, run a new sync way
          if (dbTopicsInCategory.length > 0) {
            logger.info('Syncing users for topics using groups and categories...');
            // get group id
            const referenceGroupCategory = yield helper.getEntityGroupAndCategoryOrProvision(
              reference,
              referenceId,
              users);

            // get users in the group
            const groupMembers = yield discourseClient.getUsersInGroup(referenceGroupCategory.groupName);
            const usersInGroup = _.map(groupMembers.data.members, 'username');

            const usersToAdd = _.difference(users, usersInGroup);
            _.remove(usersToAdd, val => val === DISCOURSE_SYSTEM_USERNAME);
            const usersToRemove = _.difference(usersInGroup, users);
            _.remove(usersToRemove, val => val === DISCOURSE_SYSTEM_USERNAME);
            const userIdsToRemove = usersToRemove.map(usernameToRemove => (
              _.find(groupMembers.data.members, { username: usernameToRemove }).id
            ));

            logger.debug(`users in project [${users}]`);
            logger.debug(`users in group [${usersInGroup}]`);
            logger.debug(`users to add [${usersToAdd}]`);
            logger.debug(`users to remove [${usersToRemove}]`);

            yield Promise.map(usersToAdd, (userId) => {
              logger.info(`Get or provision user (${userId})`);
              return helper.getUserOrProvision(userId);
            }, { concurrency: 4 })
              .then(() => {
                if (usersToAdd.length === 0) {
                  return Promise.resolve();
                }

                logger.info(`Adding users to group ${referenceGroupCategory.groupName}`);
                return discourseClient.addUsersToGroup(referenceGroupCategory.groupId, usersToAdd);
              })
              .then(() => Promise.map(userIdsToRemove, (userId) => {
                logger.info(`Removing user (${userId}) from group ${referenceGroupCategory.groupName}`);
                return discourseClient.removeUserFromGroup(referenceGroupCategory.groupId, userId);
              }, { concurrency: 4 }));
          }

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
