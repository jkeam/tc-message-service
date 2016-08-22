'use strict'

var _ = require('lodash');
var config = require('config');
var util = require('tc-core-library-js').util(config);
var Promise = require('bluebird');
var Discourse = require('../../services/discourse');
var errors = require('common-errors');

/**
 * Creates a new post to a topic in Discourse
 * logger: the logger
 * db: sequelize db with models loaded
 */
module.exports = (logger, db) => {
    var discourseClient = Discourse(logger);

    return (req, resp, next) => {
        return  discourseClient.createPost(req.authUser.handle, req.body.post, req.params.topicId).then((response) => {
            logger.info('Post created');
            resp.status(200).send(util.wrapResponse(req.id, {
                message: 'Post created'
            }));
        }).catch((error) => {
            logger.error(error);
            logger.debug(error.response && error.response.status);
            logger.debug(error.response && error.response.data);
            next(new errors.HttpStatusError(error.response.status, 'Error creating post'));
        });
    }

}
