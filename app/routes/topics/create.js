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
 * Handles creation of topics
 * logger: the logger
 * db: sequelize db with all models loaded
 */
module.exports = (logger, db) => {
    var discourseClient = Discourse(logger);
    var helper = HelperService(logger, db);
    var adapter = new Adapter(logger, db);

    /**
     * Create a new topic for the specified entity.
     *  - Verify if the user has access to the entity (userHasAccessToEntity function), if the user doesn't have access return 403;
     *  - Try to create a private message in Discourse (createPrivatePost in discourse.js);
     *  - If it fails, check if the user exists in Discourse, if the user doesn't exist, provision it, and try to create the private message again;
     *  - Set system, and the current user as the users in the post;
     *  - Return the newly created topic.
     * params: standard express parameters
     */
    return (req, resp, next) => {

        var logger = req.log;
        var params = req.body;

        // Validate request parameters
        Joi.assert(params, {
            reference: Joi.string().required(),
            referenceId: Joi.string().required(),
            tag: Joi.string().required(),
            title: Joi.string().required(),
            body: Joi.string().required()
        });

        helper.userHasAccessToEntity(req.authToken, req.id, params.reference, params. referenceId)
        .then(resp => {
            const hasAccess = resp[0]
            logger.debug('hasAccess: ' + hasAccess);
            if(!hasAccess)
                throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
            if (params.reference.toLowerCase() === 'project') {
                var projectMembers = _.get(resp[1], "members", [])
                // get users list
                var topicUsers = _.map(projectMembers, 'userId')
                logger.debug(topicUsers)
                return helper.lookupUserHandles(topicUsers)
            } else {
              return new Promise.resolve([req.authUser.handle])
            }
        }).then((users) => {
            logger.info('User has access to entity, creating topic in Discourse');
            // add system user
            users.push('system')
            logger.debug(users)
            return discourseClient.createPrivatePost(params.title, params.body, users.join(','), req.authUser.handle)
            .then((response) => {
                return response;
            }).catch((error) => {
                logger.debug(error);
                logger.debug(error.response && error.response.status);
                logger.debug(error.response && error.response.data);
                logger.info('Failed to create topic in Discourse');

                // If 403 or 422, it is possible that the user simply hasn't been created in Discourse yet
                if(error.response && (error.response.status == 500 || error.response.status == 403 || error.response.status == 422)) {
                    logger.info('Failed to create topic in Discourse, checking user exists in Discourse and provisioning');
                    const getUserPromises = _.map(users, user => {
                      if (user !== 'system') {
                        return helper.getUserOrProvision(req.authToken, user)
                      } else {
                        return new Promise.resolve()
                      }
                    })
                    return Promise.all(getUserPromises).then(() => {
                        logger.info('User(s) exists in Discourse, trying to create topic again');
                        return Promise.coroutine(function *() {
                            // createPrivatePost may fail again if called too soon. Trying over and over again until success or timeout
                            const endTimeMs = new Date().getTime() + config.get('createTopicTimeout');
                            const delayMs = config.get('createTopicRetryDelay');
                            for (let i = 1; ; ++i) {
                                try {
                                    logger.debug(`attempt number ${i}`);
                                    return yield discourseClient.createPrivatePost(params.title, params.body, users.join(','), req.authUser.handle);
                                } catch (e) {
                                    if(error.response && (error.response.status == 403 || error.response.status == 422)) {
                                        logger.debug(error);
                                        logger.debug(error.response && error.response.status);
                                        logger.debug(error.response && error.response.data);
                                        const timeLeftMs = endTimeMs - new Date().getTime();
                                        if (timeLeftMs > 0) {
                                            logger.info(`Create topic failed. Trying again after delay (${~~(timeLeftMs / 1000)} seconds left until timeout).`);
                                            yield Promise.delay(delayMs);
                                            continue;
                                        } else {
                                            throw new errors.HttpStatusError(500, 'Timed out while trying to create a topic in Discourse');
                                        }
                                    }
                                    throw e;
                                }
                            }
                        })();
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
                if(error.status || error.response && error.response.status) {
                    const message = _.get(error, 'response.data.errors[0]') || error.message;
                    throw new errors.HttpStatusError(error.status || error.response.status, `Failed to create topic in Discourse: ${message}`);
                }
                throw new errors.HttpStatusError(500, 'Failed to create topic in Discourse: ${error.message}');
            });
        }).then((response) => {
            logger.debug(response.data);

            const pgTopic = db.topics.build({
                reference: params.reference,
                referenceId: params.referenceId,
                discourseTopicId: response.data.topic_id,
                tag: params.tag,
                createdAt: new Date(),
                createdBy: req.authUser.handle,
                updatedAt: new Date(),
                updatedBy: req.authUser.handle
            });

            return pgTopic.save().then(() => {
                logger.info('topic saved in Postgres');
                return response.data;
            });
        }).then((topic) => {
            logger.info('returning topic');
            return discourseClient.getTopic(topic.topic_id, req.authUser.handle).then(fullTopic => {
                fullTopic.tag = params.tag;
                return adapter.adaptTopics(fullTopic).then(result => {
                    if((result instanceof Array) && result.length == 1) {
                        result = result[0];
                    }
                    return resp.status(200).send(util.wrapResponse(req.id, result));
                });
            });
        }).catch((error) => {
            next(error);
        });
    }
}
