'use strict'

var _ = require('lodash');
var config = require('config');
var Discourse = require('./discourse');
var axios = require('axios');
var errors = require('common-errors');

/**
 * Returns helper service containing common functions used in route handlers
 * logger: the logger
 * db: sequelize db with all models loaded
 */
module.exports = (logger, db) => {

    var discourseClient = Discourse(logger);

    /**
     * Fetches a topcoder user from the topcoder members api
     * authToken: The user's authentication token, will be used to call the member service api
     * handle: handle of the user to fetch
     */
    function getTopcoderUser(authToken, handle) {
        return axios.get(config.memberServiceUrl + '/' + handle, {
            headers: {
                'Authorization': 'Bearer ' + authToken,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        }).then((response) => {
            logger.debug(response.data);
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
    function userHasAccessToEntity(authToken, reference, referenceId) {
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
            logger.debug(result.dataValues);
            var referenceLookup = result;
            return axios.get(referenceLookup.endpoint.replace('{id}', referenceId), {
                headers: {
                    'X-Request-Id': '123',
                    'Authorization': 'Bearer ' + authToken,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: config.get('referenceLookupTimeout')
            }).then((response) => {
                logger.debug(response.data);
                if(response.data && response.data.result
                    && response.data.result.status == 200 && response.data.result.content) {
                    return true;
                } else {
                    return false;
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
    function getUserOrProvision(authToken, userHandle) {
        return discourseClient.getUser(userHandle).then((user) => {
            logger.debug(user);
            logger.info('Successfully got the user from Discourse');
            return user;
        }).catch((error) => {
            logger.debug(error);
            logger.info('Discourse user doesn\'t exist, creating one');
            // User doesn't exist, create
            // Fetch user info from member service
            return this.getTopcoderUser(authToken, userHandle)
            .catch((error) => {
                logger.debug(error);
                throw new errors.HttpStatusError(500, 'Failed to get topcoder user info');
            }).then((user) => {
                logger.debug(user);
                logger.info('Successfully got topcoder user');
                // Create discourse user
                return discourseClient.createUser(user.firstName + ' ' + user.lastName,
                        user.handle,
                        user.email,
                        config.defaultDiscoursePw);
            }).then((result) =>{
                logger.debug(result.data);
                if(result.data.success) {
                    logger.info('Discourse user created');
                    return result.data;
                } else {
                    logger.error('Unable to create discourse user');
                    throw new errors.HttpStatusError(500, 'Unable to create discourse user');
                }
            }).catch((error) => {
                logger.debug(error);
                logger.error('Failed to create discourse user');
                throw error;
            });
        });
    }
    
    /**
     * Checks if a user has access to an entity, and if they do, provision a user in Discourse if one doesn't exist
     * authToken: user's auth token to use to call the Topcoder api to get user info for provisioning
     * userHandle: handle of the user
     * reference: name of the reference, used to find the endpoint in the referenceLookupTable
     * referenceId: identifier of the reference record
     */
    function checkAccessAndProvision(authToken, userHandle, reference, referenceId) {
        return this.userHasAccessToEntity(authToken, reference, referenceId).then((hasAccess) => {
            logger.debug('hasAccess: ' + hasAccess);
            if(!hasAccess) {
                throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
            }
        }).then(() => {
            logger.info('User has access to entity');
            return this.getUserOrProvision(authToken, userHandle);
        });
    }

    return {
        getTopcoderUser: getTopcoderUser,
        userHasAccessToEntity: userHasAccessToEntity,
        getUserOrProvision: getUserOrProvision,
        checkAccessAndProvision: checkAccessAndProvision
    };
}
