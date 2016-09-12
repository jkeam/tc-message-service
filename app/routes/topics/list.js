'use strict'

var _ = require('lodash');
var config = require('config');
var util = require('tc-core-library-js').util(config);
var Promise = require('bluebird');
var Discourse = require('../../services/discourse');
var HelperService = require('../../services/helper');
var axios = require('axios');
var errors = require('common-errors');
var Joi = require('joi');
var Adapter = require('../../services/adapter'); 

/**
 * Handles listing of topics
 * logger: the logger
 * db: sequelize db with all models loaded
 */
module.exports = (logger, db) => {
    var discourseClient = Discourse(logger);
    var helper = HelperService(logger, db);
    var adapter = new Adapter(logger);

    /**
     * Gets topics from Discourse for the specified entity, and in the process it does:
     *  - Checks if the user has access to the referred entity
     *  - Checks if a user exists in Discourse, if not, it creates one
     *  - Checks if a topic associated with this entity exists in Discourse, if not creates one
     *  - If the topic already exists, checks if the user has access, if not gives access
     * params: standard express parameters
     */
    return (req, resp, next) => {
        // Validate request parameters
        Joi.assert(req.query, {
            filter: Joi.string().required()
        });

        // Parse filter
        var parsedFilter = (req.query.filter || '').split('&');
        var filter = {};

        _(parsedFilter).each(value => {
            const parts = value.split('=');

            if(parts.length == 2) {
                filter[parts[0]] = parts[1];
            }
        });

        // Verify required filters are present
        if(!filter.reference || !filter.referenceId) {
            return next(new errors.HttpStatusError(400, 'Please provide reference and referenceId filter parameters'));
        }

        // Get topics from the Postgres database
        db.topics.findAll({ where: filter }).then((result) => {
            if(result.length === 0) {
                throw new errors.HttpStatusError(404, 'Topic does not exist');
            }

            logger.info('Topics exist in pg, fetching from discourse');

            let checkAccessAndProvisionPromise = null;

            const topicPromises = result.map(pgTopic => {
                logger.debug(pgTopic.dataValues);
                return discourseClient.getTopic(pgTopic.discourseTopicId, req.authUser.handle).then((response) => {
                    logger.info(`Topic received from discourse: ${pgTopic.discourseTopicId}`);
                    return response;
                }).catch((error) => {
                    logger.debug(error);
                    logger.debug(error.response && error.response.status);
                    logger.debug(error.response && error.response.data);
                    logger.info(`Failed to get topic from discourse: ${pgTopic.discourseTopicId}`);

                    // If 403, it is possible that the user simply hasn't been granted access to the topic yet
                    if(error.response && error.response.status == 403) {
                        logger.info(`User doesn\'t have access to topic ${pgTopic.discourseTopicId}, checking access and provisioning`);

                        if(!checkAccessAndProvisionPromise) {
                            // Check and provision is only needed to be done once
                            checkAccessAndProvisionPromise = helper.checkAccessAndProvision(req.authToken, req.authUser.handle,
                                filter.reference, filter.referenceId);
                        }

                        // Verify if the user has access and if so provision
                        return checkAccessAndProvisionPromise.then((discourseUser) => {
                            logger.debug(discourseUser);
                            // Grant access to the topic to the user
                            logger.info(`User entity access verified, granting access to topic ${pgTopic.discourseTopicId}`);
                            return discourseClient.grantAccess(req.authUser.handle, pgTopic.discourseTopicId);
                        }).then((response) => {
                            logger.debug(response.data);
                            logger.info(`Succeeded to grant access to topic ${pgTopic.discourseTopicId}`);
                            return discourseClient.getTopic(pgTopic.discourseTopicId, req.authUser.handle);
                        }).then((response) => {
                            logger.info(`Topic received from discourse ${pgTopic.discourseTopicId}`);
                            return response;
                        }).catch((error) => {
                            logger.debug(error);
                            logger.debug(error.response && error.response.status);
                            logger.debug(error.response && error.response.data);
                            throw error;
                        });
                    } else {
                        throw error;
                    }
                }).catch((error) => {
                    logger.debug(error);
                    logger.info(`Failed to get topic from discourse: ${pgTopic.discourseTopicId}`);
                    // Swallowing errors to be able to return partial result
                    return null;
                });
            });

            return Promise.all(topicPromises).then((topics) => {
                // chaining to checkAccessAndProvisionPromise if it exists, to ensure that we don't miss access errors
                return (checkAccessAndProvisionPromise || Promise.resolve()).then(() => {
                    // filter null topics and sort in the  order of the last activity date descending (more recent activity first)
                    return _.chain(topics)
                        .filter(topic => topic != null)
                        .orderBy(['last_posted_at'], ['desc'])
                        .value();
                });
            });
        }).then((topics) => {
            if(topics.length === 0) {
                throw new errors.HttpStatusError(404, 'Topic does not exist');
            }
            logger.debug(topics);
            logger.info('returning topics');

            // Mark all unread topics as read.
            Promise.all(topics.filter(topic => !topic.read).map(topic => {
                if(topic.post_stream && topic.post_stream.posts && topic.post_stream.posts.length > 0) {
                    var postIds = topic.post_stream.posts.map(post => post.post_number);
                    return discourseClient.markTopicPostsRead(req.authUser.handle, topic.id, postIds);
                } else {
                    return Promise.resolve();
                }
            })).catch((error) => {
                logger.error('error marking topic posts read', error);
            });

            return adapter.adaptTopics(topics, req.authToken).then(result => {
                return resp.status(200).send(util.wrapResponse(req.id, result));
            });
        }).catch((error) => {
            next(error);
        });
    }
}
