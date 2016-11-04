'use strict'

var _ = require('lodash');
var config = require('config');
var util = require('tc-core-library-js').util(config);
var Promise = require('bluebird');
var Discourse = require('../../services/discourse');
var errors = require('common-errors');
var Adapter = require('../../services/adapter');

/**
 * Creates a new post to a topic in Discourse
 * logger: the logger
 * db: sequelize db with models loaded
 */
module.exports = (logger, db) => {
    var discourseClient = Discourse(logger);
    var adapter = new Adapter(logger, db);

   return (req, resp, next) => {
     var logger = req.log
        if(!req.query.postIds) {
            return resp.status(400).send('Post ids parameter is required');
        }

        var postIds = req.query.postIds.split(',');
        return  discourseClient.getPosts(req.authUser.handle, req.params.topicId, postIds).then((response) => {
            logger.info('Fetched posts from discourse');

            return adapter.adaptPosts(req.authUser.handle, response.data).then(post => {
                return resp.status(200).send(util.wrapResponse(req.id, post));
            });
        }).catch((error) => {
            logger.error(error);
            logger.debug(error.response && error.response.status);
            logger.debug(error.response && error.response.data);
            next(new errors.HttpStatusError(error.response.status, 'Error fetching posts'));
        });
    }

}
