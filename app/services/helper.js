'use strict'

var _ = require('lodash');
var config = require('config');
var Discourse = require('./discourse');
var axios = require('axios');
var errors = require('common-errors');
var util = require('../util')

/**
 * Returns helper service containing common functions used in route handlers
 * logger: the logger
 * db: sequelize db with all models loaded
 */
module.exports = (logger, db) => {

    var discourseClient = Discourse();

    /**
     * [lookupUserHandles description]
     * @param  {[type]} userIds [description]
     * @param  {[type]} userIds [description]
     * @return {[type]}         [description]
     */
    function lookupUserHandles(logger, userIds) {

      return axios.get(`${config.get('memberServiceUrl')}/_search`, {
        params: {
          fields: 'handle',
          query: _.map(userIds, i => { return `userId:${i}` }).join(' OR ')
        }
      }).then(response => {
        logger.debug('UserHandle response', response.data)
        var data = _.get(response, 'data.result.content', null)
        if (!data)
          throw new Error('Response does not have result.content');
        return _.map(data, 'handle').filter(i => i)
      })
    }

    /**
     * Fetches a topcoder user from the topcoder members api
     * logger: request logger that logs along with request id for tracing
     * handle: handle of the user to fetch
     */
    function getTopcoderUser(logger, handle) {
        // get admin user token and make the call to member service endpoint
        logger.debug('retrieving userToken')
        return util.getSystemUserToken(logger)
          .then(token => {
            logger.debug('retrieved token invoking member service')
            return axios.get(config.memberServiceUrl + '/' + handle, {
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            })
          })
          .then(response => {
            logger.debug('retrieved user', response.data);
            if (!_.get(response, 'data.result.content'))
                throw new Error('Response does not have result.content');
            return response.data.result.content;
          });
    }

    /**
     * Verifies if a user has access to a certain topcoder entity such as a project,
     * challenge, or submission, by making a call to the api configured in the referenceLookup table
     * authToken: user's auth token to use to call the api
     * reference: name of the reference, used to find the endpoint in the referenceLookupTable
     * referenceId: identifier of the reference record
     */
    function userHasAccessToEntity(authToken, requestId, reference, referenceId) {
        return db.referenceLookups.findOne({
            where: {
                reference: reference
            }
        }).then((result) => {
            if(!result) {
                logger.debug('no result');
                return true; // if nothing exists in the referenceLookup table, the entity should be open,
                             // and anyone should be able to see the threads
            }
            var referenceLookup = result;
            return axios.get(referenceLookup.endpoint.replace('{id}', referenceId), {
                headers: {
                    'X-Request-Id': requestId,
                    'Authorization': 'Bearer ' + authToken,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: config.get('referenceLookupTimeout')
            }).then((response) => {
                logger.debug(response.data);
                if(response.data && response.data.result
                    && response.data.result.status == 200 && response.data.result.content) {
                    return [true, response.data.result.content];
                } else {
                    return [false, null];
                }
            }).catch((error) => {
                logger.debug(error);
                return false;
            });
        });
    }

    /**
     * Get user from discourse provision a user in Discourse if one doesn't exist
     * authToken: user's auth token to use to call the Topcoder api to get user info for provisioning
     * userHandle: handle of the user to fetch
     */
    function getUserOrProvision(logger, userHandle) {
        return discourseClient.getUser(userHandle).then((user) => {
            // logger.debug(user);
            logger.info('Successfully got the user from Discourse', userHandle);
            return user;
        }).catch((error) => {
            logger.info('Discourse user doesn\'t exist, creating one', userHandle);
            // User doesn't exist, create
            // Fetch user info from member service
            return this.getTopcoderUser(logger, userHandle)
            .catch((error) => {
                logger.error('Error retrieving topcoder user', error);
                throw new errors.HttpStatusError(500, 'Failed to get topcoder user info');
            }).then((user) => {
                logger.info('Successfully got topcoder user', JSON.stringify(user));
                // Create discourse user
                return discourseClient.createUser(logger, encodeURIComponent(user.firstName) + ' ' + encodeURIComponent(user.lastName),
                        user.handle,
                        user.email,
                        config.defaultDiscoursePw);
            }).then((result) =>{
                if(result.data.success) {
                    logger.info('Discourse user created');
                    return result.data;
                } else {
                    logger.error('Unable to create discourse user', result.data);
                    throw new errors.HttpStatusError(500, 'Unable to create discourse user');
                }
            }).catch((error) => {
                logger.error('Failed to create discourse user', error);
                throw error;
            });
        });
    }

    /**
     * Checks if a user has access to an entity, and if they do, provision a user in Discourse if one doesn't exist
     * logger: request logger that logs request id with each log
     * authToken: user's auth token to use to call the Topcoder api to get user info for provisioning
     * userHandle: handle of the user
     * reference: name of the reference, used to find the endpoint in the referenceLookupTable
     * referenceId: identifier of the reference record
     */
    function checkAccessAndProvision(logger, authToken, requestId, userHandle, reference, referenceId) {
        return this.userHasAccessToEntity(authToken, requestId, reference, referenceId).then((resp) => {
            var hasAccess = resp[0]
            logger.debug('hasAccess: ' + hasAccess);
            if(!hasAccess) {
                throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
            }
        }).then(() => {
            logger.info('User has access to entity');
            return this.getUserOrProvision(logger, userHandle);
        });
    }

    return {
        getTopcoderUser: getTopcoderUser,
        lookupUserHandles: lookupUserHandles,
        userHasAccessToEntity: userHasAccessToEntity,
        getUserOrProvision: getUserOrProvision,
        checkAccessAndProvision: checkAccessAndProvision
    };
}
