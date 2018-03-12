

const _ = require('lodash');
const config = require('config');
const Discourse = require('./discourse');
const axios = require('axios');
const errors = require('common-errors');
const util = require('../util');
const Promise = require('bluebird');
const { USER_ROLE } = require('../constants');

const DISCOURSE_SYSTEM_USERNAME = config.get('discourseSystemUsername');

/**
 * Returns helper service containing common functions used in route handlers
 * @param {Object} logger the logger
 * @param {Object} db sequelize db with all models loaded
 * @param {Object} _discourseClient optional
 * @return {function} function
 */
module.exports = (logger, db, _discourseClient = null) => {
  const discourseClient = _discourseClient || new Discourse(logger);

  /**
   * Lookup user handles from userIds
   * @param  {Array} userIds user Identifiers
   * @return {Promise} promise
   */
  function lookupUserHandles(userIds) {
    return axios.get(`${config.get('memberServiceUrl')}/_search`, {
      params: {
        fields: 'handle',
        query: _.map(userIds, i => `userId:${i}`).join(' OR '),
      },
    }).then((response) => {
      const data = _.get(response, 'data.result.content', null);
      if (!data) { throw new Error('Response does not have result.content'); }
      logger.debug('UserHandle response', data);
      return _.map(data, 'handle').filter(i => i);
    });
  }

  /**
   * Fetches a topcoder user from the topcoder members api
   * @param {String} handle handle of the user to fetch
   * @return {Promise} promise
   */
  function getTopcoderUser(handle) {
    // get admin user token and make the call to member service endpoint
    logger.debug('retrieving userToken');
    return util.getSystemUserToken(logger)
      .then((token) => {
        logger.debug('retrieved token invoking member service');
        return axios.get(`${config.memberServiceUrl}/${handle}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        });
      })
      .then((response) => {
        // logger.debug('retrieved user', response.data);
        if (!_.get(response, 'data.result.content')) { throw new Error('Response does not have result.content'); }
        return response.data.result.content;
      });
  }

  /**
   * finds handle of user from userId,
   * @param {Number} userId userId of user
   * @return {Promise} promise
   */
  function lookupUserFromId(userId) {
    return lookupUserHandles([userId])
      .then(handles => getTopcoderUser(handles[0]));
  }

  /**
   * Verifies if a user has access to a certain topcoder entity such as a project,
   * challenge, or submission, by making a call to the api configured in the referenceLookup table
   * @param {String} authToken user's auth token to use to call the api
   * @param {String} requestId request identifier
   * @param {String} reference name of the reference, used to find the endpoint in the referenceLookupTable
   * @param {String} referenceId identifier of the reference record
   * @return {Promise} promise
   */
  function userHasAccessToEntity(authToken, requestId, reference, referenceId) {
    return db.referenceLookups.findOne({ where: { reference } })
    .then((result) => {
      if (!result) {
        logger.debug('no result');
        return [true, null]; // if nothing exists in the referenceLookup table, the entity should be open,
        // and anyone should be able to see the threads
      }
      const referenceLookup = result;
      return axios.get(referenceLookup.endpoint.replace('{id}', referenceId), {
        headers: {
          'X-Request-Id': requestId,
          Authorization: `Bearer ${authToken}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        timeout: config.get('referenceLookupTimeout'),
      }).then((response) => {
        logger.debug(response.data);
        if (response.data && response.data.result &&
          response.data.result.status === 200 && response.data.result.content) {
          return [true, response.data.result.content];
        }
        return [false, null];
      }).catch((error) => {
        logger.debug(error);
        return [false, null, error];
      });
    });
  }

  /**
   * Get user from discourse provision a user in Discourse if one doesn't exist
   * @param {String} userId userId of the user to fetch
   * @return {Promise} promise
   */
  function getUserOrProvision(userId) {
    logger.debug('Verifying if user exsits in Discourse:', userId);
    return discourseClient.getUser(userId).then((user) => {
      logger.info('Successfully got the user from Discourse', userId);
      return user;
    }).catch(() => {
      logger.info('Discourse user doesn\'t exist, creating one', userId);
      // User doesn't exist, create
      // Fetch user info from member service
      return this.lookupUserFromId(userId)
        .catch((error) => {
          logger.error('Error retrieving topcoder user', error);
          throw new errors.HttpStatusError(500, 'Failed to get topcoder user info');
        }).then((user) => {
          logger.info('Successfully got topcoder user', JSON.stringify(user));
          // Create discourse user
          return discourseClient.createUser(
            `${encodeURIComponent(user.firstName)} ${encodeURIComponent(user.lastName)}`,
            user.userId.toString(),
            user.handle,
            user.email,
            config.defaultDiscoursePw);
        }).then((result) => {
          if (result.data.success) {
            logger.info('Discourse user created');
          } else {
            logger.error('Unable to create discourse user', result.data);
            throw new errors.HttpStatusError(500, 'Unable to create discourse user');
          }
          return discourseClient.changeTrustLevel(result.data.user_id, config.get('defaultUserTrustLevel'));
        })
        .then((result) => {
          if (result.status === 200) {
            logger.info('Discourse user trust level changed');
            return result.data;
          }
          logger.error('Unable to change discourse user trust level', result);
          throw new errors.HttpStatusError(500, 'Unable to change discourse user trust level');
        })
        .catch((error) => {
          logger.error('Failed to create discourse user', error);
          throw error;
        });
    });
  }

  /**
   * Get users from discourse or provision users in Discourse if some doesn't exist
   * @param {String} users user ids  to fetch
   * @return {Promise} promise
   */
  function getUsersOrProvision(users) {
    const getUserPromises = _.map(users, (user) => {
      if (user !== DISCOURSE_SYSTEM_USERNAME) {
        return this.getUserOrProvision(user);
      }
      return new Promise.resolve(); // eslint-disable-line
    });
    return Promise.all(getUserPromises);
  }

  /**
   *
   * @param {String} groupName group name
   * @param {Array} users list of users to add ot the group
   * @return {Promise} resolves to the object with data.basic_group property
   */
  function createGroupWithUsers(groupName, users) {
    logger.info(`Creating group '${groupName}'...`);
    return discourseClient.createGroup(groupName)
      .then((groupResponse) => {
        if (!users) {
          logger.info(`No users to add to the group '${groupName}'`);
          return groupResponse;
        }

        logger.info(`Making sure that users [${users.join(',')}] exist in the Discourse.`);

        return this.getUsersOrProvision(users)
          .then(() => {
            logger.info(`Adding user to the new group '${groupName}'`);

            return discourseClient.addUsersToGroup(groupResponse.data.basic_group.id, users)
              .then(() => groupResponse);
          });
      });
  }

  /**
   * Returns associated Discourse group and category for pair of reference and referenceId
   * @param {String} reference   name of the reference
   * @param {String} referenceId identifier of the reference record
   * @param {Array}  users       usernames to add to the newly created group if it doesn't exist
   * @return {Promise} promise
   */
  function getEntityGroupAndCategoryOrProvision(reference, referenceId, users) {
    logger.debug(`Checking if entity '${reference}' '${referenceId}' already has group and category`);

    return db.referenceGroupCategory.findOne({ where: { reference, referenceId: referenceId.toString() } })
      .then((referenceGroupCategory) => {
        if (referenceGroupCategory) {
          logger.info(`Successfully got group and category for entity '${reference}' '${referenceId}'`);
          return referenceGroupCategory;
        }

        logger.info(`Entity '${reference}' '${referenceId}' doesn't have group and category, creating one`);
        // we create group and category in Discourse and save their ids in referenceGroupCategory
        // add 5 random digits. Cannot add a lot, because Group name cannot be longer than 20 characters
        const random = (Math.random()).toString().substring(2, 7);
        const groupName = `${reference}-${referenceId}-G${random}`;
        if (groupName.length > 20) {
          throw new errors.HttpStatusError(500, 'Group name is longer than 20 characters. '
            + 'You have to update the code to generate shorter unique group names.');
        }
        const categoryName = `${reference}-${referenceId}-C${random}`;

        return this.createGroupWithUsers(groupName, users).then((groupResponse) => {
          const group = groupResponse.data.basic_group;

          logger.info(`Creating a category '${categoryName}' with permissions for group '${group.name}'...`);
          return discourseClient.createCategory(categoryName, group.name).then((categoryResponse) => {
            logger.info(`Category '${categoryName}' was successfully created.`);
            const category = categoryResponse.data.category;

            const newReferenceGroupCategory = db.referenceGroupCategory.build({
              reference,
              referenceId: referenceId.toString(),
              categoryId: category.id,
              groupId: group.id,
              groupName: group.name,
            });

            logger.info('Saving entity group and category in Postgres...');
            return newReferenceGroupCategory.save().then((savedReferenceGroupCategory) => {
              logger.info('Entity group and category saved in Postgres');
              return savedReferenceGroupCategory;
            });
          });
        });
      });
  }

  /**
   * Checks if a user has access to an entity, and if they do, provision a user in Discourse if one doesn't exist
   * @param {String} authToken user's auth token to use to call the Topcoder api to get user info for provisioning
   * @param {String} requestId request identifier
   * @param {String} userId userId of the user
   * @param {String} reference name of the reference, used to find the endpoint in the referenceLookupTable
   * @param {String} referenceId identifier of the reference record
   * @return {Promise} promise
   */
  function checkAccessAndProvision(authToken, requestId, userId, reference, referenceId) {
    return this.userHasAccessToEntity(authToken, requestId, reference, referenceId).then((resp) => {
      const hasAccess = resp[0];
      logger.debug(`hasAccess: ${hasAccess}`);
      if (!hasAccess) {
        throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
      }
    }).then(() => {
      logger.info('User has access to entity');
      return this.getUserOrProvision(userId);
    });
  }


  /**
   * Returns handle or userId from @ mentions
   * @param {Object} match:  @mention
   * @return {object} object
   */
  function getContentFromMatch(match) {
    return match.slice(2);
  }

  /**
   * Returns converts mentions from discourse @userId to @handles
   * match: converted string
   */

  function mentionUserIdToHandle(post) {
    const userIdRex = />(@[^\<]+)/g; // eslint-disable-line
    const htmlRex = /s\/([^\"]+)/g; // eslint-disable-line
    const userIds = _.map(post.match(userIdRex), getContentFromMatch);
    const handleMap = {};
    return Promise.each(userIds, userId => this.lookupUserFromId(userId).then((data) => {
      const handle = data.handle;
      if (handle) {
        handleMap[userId] = handle;
      } else {
        logger.error(`Cannot find user with userId ${userId}`);
      }
    }).catch(() => {
      logger.info(`not valid mention ${userId}`);
    })).then(() => post.replace(userIdRex, (match) => {
      const handle = handleMap[getContentFromMatch(match)];
      if (handle) {
        return `>@${handle}`;
      }
      return match;
    }).replace(htmlRex, (match) => {
      const handle = handleMap[getContentFromMatch(match)];
      if (handle) {
        return `s/${handle}`;
      }
      return match;
    }));
  }

  function isAdmin(req) {
    return _.intersection([
      USER_ROLE.TOPCODER_ADMIN,
      USER_ROLE.CONNECT_ADMIN,
      USER_ROLE.MANAGER,
    ], req.authUser.roles).length > 0;
  }

  return {
    getTopcoderUser,
    lookupUserHandles,
    lookupUserFromId,
    userHasAccessToEntity,
    getUserOrProvision,
    getUsersOrProvision,
    checkAccessAndProvision,
    getContentFromMatch,
    mentionUserIdToHandle,
    isAdmin,
    getEntityGroupAndCategoryOrProvision,
    createGroupWithUsers,
  };
};
