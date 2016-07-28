'use strict'

var _ = require('lodash');
var config = require('config');
var util = require('tc-core-library-js').util(config);
var Promise = require('bluebird');
var Discourse = require('../../services/discourse');
var axios = require('axios');

/**
 * Handles listing of threads
 * logger: the logger
 * db: sequelize db with all models loaded
 */
module.exports = (logger, db) => {
    var discourseClient = Discourse(logger);

    /**
     * Checks if a thread lookup exists, if it does it means there is security 
     * enabled for this given entity, and we should check if the user has access 
     * to the entity before allowing access to the threads
     * filter: {'reference': referenceName }
     */
    function threadLookupExists(filter) {
        return db.threads.findAll({
            where: filter
        }).then((result) => {
            return result;
        });
    }

    /**
     * Fetches a topcoder user from the topcoder members api
     * authToken: The user's authentication token, will be used to call the member service api
     * handle: handle of the user to fetch
     */
    function getTopcoderUser(authToken, handle) {
        return new Promise((resolve, reject) => {
            axios.create({
                headers: {
                    'Authorization': authToken,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }).get(config.memberServiceUrl + '/' + handle).then((response) => {
                resolve(response.data.result.content);
            }).catch((error) => {
                reject(error);
            });
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
        return new Promise((resolve, reject)  => {
            db.referenceLookups.findOne({
                where: {
                    reference: reference
                } 
            }).then((result) => {
                if(!result) {
                    resolve(true);
                } else {
                    var referenceLookup = result;

                    util.getHttpClient({
                        id: '123',
                        headers: {
                            'Authorization': 'Bearer ' + authToken,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    }).get(referenceLookup.endpoint.replace('{id}', referenceId)).then((response) => {
                        if(response.data.result.status == 200 && response.data.result.content) {
                            resolve(true);
                        }
                    }).catch((error) => {
                        resolve(false);
                    });
                 }
            });
        });
    }

    /**
     * Checks if a user has access to an entity, and if they do, provision a user in Discourse if one doesn't exist
     * req: the express request
     * filter: {'reference': reference, 'referenceId': referenceId}
     */
    function checkAccessAndProvision(req, filter) {
        return userHasAccessToEntity(req.header.authorization, filter.reference, filter.referenceId).then((hasAccess) => {
            logger.info('here');
            if(!hasAccess) {
                return Promise.reject('User doesn\'t have access to entity');
            } else {
                logger.info('User has access to entity');
                // Does the discourse user exist
                return discourseClient.getUser(req.authUser.handle).then((user) => {
                    logger.info('Successfully got the user from Discourse');
                    return user;
                }).catch((error) => {
                    logger.info('Discourse user doesn\'t exist, creating one');
                    // User doesn't exist, create
                    // Fetch user info from member service
                    return getTopcoderUser(req.headers.authorization, req.authUser.handle).then((user) => {
                        logger.info('Successfully got topcoder user');
                        logger.info(user);

                        // Create discourse user 
                        return discourseClient.createUser(user.firstName + ' ' + user.lastName,
                                user.handle,
                                user.email,
                                config.defaultDiscoursePw).then((result) =>{
                            if(result.data.success) {
                                logger.info('Discourse user created');
                                return result.data;
                            } else {
                                logger.error("Unable to create discourse user");
                                logger.error(result);
                                return Promise.reject(result);
                            }
                        }).catch((error) => {
                            logger.error('Failed to create discourse user');
                            return Promise.reject(error); 
                        });
                    }).catch((error) => {
                        return Promise.reject(error);    
                    });
                });
            }
        });
    }

    /**
     * Gets a thread from Discourse, and in the process it does:
     *  - Checks if the user has access to the referred entity
     *  - Checks if a user exists in Discourse, if not, it creates one
     *  - Checks if a thread associated with this entity exists in Discourse, if not creates one
     *  - If the thread already exists, checks if the user has access, if not gives access
     * params: standard express parameters
     */
    return (req, resp) => {
        // Verify required filters are present
        if(!req.query.filter) {
            resp.status(400).send({
                message: 'Please provide reference and referenceId filter parameters'
            });

            return;
        }
    
        // Parse filter
        var parsedFilter = req.query.filter.split('&');
        var filter = {};
    
        _(parsedFilter).each(value => {
            let split = value.split('=');
            
            if(split.length == 2) {
                filter[split[0]] = split[1];
            }
        });
   
        var pgThread;

        // Check if the thread exists in the pg database
        threadLookupExists(filter).then((result) => {
            if(result.length === 0) {
                logger.info('thread doesn\'t exist');
                return checkAccessAndProvision(req, filter).then(() => {
                    return discourseClient.createPrivateMessage(
                        'Discussion for ' + filter.reference + ' ' + filter.referenceId, 
                        'Discussion for ' + filter.reference + ' ' + filter.referenceId, 
                        req.authUser.handle).then((response) => {
                        if(response.status == 200) {
                            pgThread = db.threads.build({
                                reference: filter.reference,
                                referenceId: filter.referenceId,
                                discourseThreadId: response.data.topic_id,
                                createdAt: new Date(),
                                createdBy: req.authUser.handle,
                                updatedAt: new Date(),
                                updatedBy: req.authUser.handle
                            });
   
                            return pgThread.save().then((result) => {
                                logger.info('thread created in pg');
                                return response;
                            }).catch((error) => {
                                logger.error(error);
                                return Promise.reject(error);
                            });
                        } else {
                            return Promise.reject(response);
                        }
                    });
                }).catch((error) => {
                    return Promise.reject(error);
                });
            } else {
                logger.info('Thread exists in pg, fetching from discourse'); 
                pgThread = result[0];
                return discourseClient.getThread(pgThread.discourseThreadId, req.authUser.handle).then((response) => {
                    logger.info('Thread received from discourse');
                    return response;
                }).catch((error) => {
                    logger.info('Failed to get thread from discourse');

                    // If 403, it is possible that the user simply hasn't been granted access to the thread yet
                    if(error.response.status = 403) {
                        logger.info('User doesn\'t have access to thread, checking access and provisioning');

                        // Verify if the user has access and if so provision
                        return checkAccessAndProvision(req, filter).then((discourseUser) => {
                            // Grand access to the thread to the user
                            logger.info('User entity access verified, granting access to thread');
                            return discourseClient.grantAccess(req.authUser.handle, pgThread.discourseThreadId).then(() => {
                                return discourseClient.getThread(pgThread.discourseThreadId, req.authUser.handle).then((response) => {
                                    logger.info('Thread received from discourse');
                                    return response;
                                });
                            });
                        });
                    } else {
                        logger.error(error);
                        return Promise.reject(error);
                    }
                });
            }
        }).then((thread) => {
            // Retrive the thread from Discourse
            logger.info('returning thread'); 
            return resp.status(200).send(thread.data);
        }).catch((error) => {
            logger.error(error);
            resp.status(500).send({
                message: 'Error fetching thread!'
            });
        });
    }
}
