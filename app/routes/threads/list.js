'use strict'

var _ = require('lodash');
var config = require('config');
var util = require('tc-core-library-js').util(config);
var Promise = require('bluebird');
var Discourse = require('../../services/discourse');

module.exports = (logger, db) => {
    var discourseClient = Discourse(logger);

    function threadLookupExists(filter) {
        return db.threads.findAll({
            where: filter
        }).then((result) => {
            return result;
        });
    }

    function getTopcoderUser(authToken, handle) {
        return new Promise((resolve, reject) => {
            util.getHttpClient({
                id: '123',
                headers: {
                    'Authorization': 'Bearer ' + authToken,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }).get(config.memberServiceUrl + '/' + handle).then((response) => {
                resolve(response.data.result.content);
            }).catch((error) => {
                //logger.error(error);
                reject(error);
            });
       }); 
    }

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

    return (req, resp, next) => {
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
    
        // Check if the thread exists in the pg database
        threadLookupExists(filter).then((result) => {
            if(result.length === 0) {
                console.log('thread doesn\'t exist');
                return userHasAccessToEntity(req.headers.authorization, filter.reference, filter.referenceId).then((hasAccess) => {
                    if(!hasAccess) {
                        return Promise.reject('User doesn\'t have access to entity');
                    } else {
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
                        }).then(() => {
                            return discourseClient.createPrivateMessage(
                                'Discussion for ' + filter.reference + ' ' + filter.referenceId, 
                                'Discussion for ' + filter.reference + ' ' + filter.referenceId, 
                                req.authUser.handle + ',mdesiderio').then((response) => {
                                if(response.status == 200) {
                                    var thread = db.threads.build({
                                       reference: filter.reference,
                                       referenceId: filter.referenceId,
                                       discourseThreadId: response.data.topic_id,
                                       createdAt: new Date(),
                                       createdBy: req.authUser.handle,
                                       updatedAt: new Date(),
                                       updatedBy: req.authUser.handle
                                    });

                                    return thread.save().then((result) => {
                                        logger.info('thread created in pg');
                                        return response.data;
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
                    }
                });
            } else {
                logger.info('Thread exists in pg, fetching from discourse'); 
                return discourseClient.getThread(result[0].discourseThreadId, req.authUser.handle).then((response) => {
                    logger.info('Thread received from discourse');
                    return response;
                }).catch((error) => {
                    logger.error('Failed to get thread from discourse');
                    logger.error(error);
                    Promise.reject(error);
                });
            }
        }).then((thread) => {
            // Retrive the thread from Discourse
            console.log(thread);
            return resp.status(200).send(thread.data);
        }).catch((error) => {
            logger.error(error);
            resp.status(500).send({
                message: 'Error fetching thread!'
            });
        });
    }
}
