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
 * Get specific topic
 * logger: the logger
 * db: sequelize db with all models loaded
 */
module.exports = (logger, db) => {
    var discourseClient = Discourse(logger);
    var helper = HelperService(logger, db);
    var adapter = new Adapter(logger, db);

    /**
     * Gets topic from Discourse for the specified entity, and in the process it does:
     *  - Checks if the user has access to the referred entity
     *  - Checks if a user exists in Discourse, if not, it creates one
     *  - Checks if a topic associated with this entity exists in Discourse, if not creates one
     *  - If the topic already exists, checks if the user has access, if not gives access
     * params: standard express parameters
     */
    return (req, resp, next) => {
        var logger = req.log
        var topicId = req.params.topicId;

        // Get topic from the Postgres database
        db.topics.findAll({
            where: {
                discourseTopicId: topicId
            }
        }).then((pgTopic) => {
            if(!pgTopic || pgTopic.length == 0) {
                throw new errors.HttpStatusError(404, 'Topic does not exist');
            } else {
                pgTopic = pgTopic[0];
            }

            logger.info('Topics exist in pg, fetching from discourse');

            let checkAccessAndProvisionPromise = null;

            logger.debug(pgTopic.dataValues);
            return discourseClient.getTopic(pgTopic.discourseTopicId, req.authUser.handle).then((response) => {
                logger.info(`Topic received from discourse: ${pgTopic.discourseTopicId}`);
                response.tag = pgTopic.tag;
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
                        checkAccessAndProvisionPromise = helper.checkAccessAndProvision(req.logger, req.authToken, req.id, req.authUser.handle,
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
            });

        }).then((topic) => {
            if(!topic) {
                throw new errors.HttpStatusError(404, 'Topic does not exist');
            }
            logger.debug(topic);
            logger.info('returning topic');
            return adapter.adaptTopics(topic, req.authToken).then(result => {
                return resp.status(200).send(util.wrapResponse(req.id, result));
            });
        }).catch((error) => {
            next(error);
        });
    }
}
