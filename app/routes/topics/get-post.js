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
 * db: sequelize db with models loaded
 */
module.exports = (db) => {
  return (req, resp, next) => {
    var logger = req.log
    var discourseClient = Discourse(logger);
    var adapter = new Adapter(logger, db);

    if (!req.query.postIds) {
      return resp.status(400).send('Post ids parameter is required');
    }

    var postIds = req.query.postIds.split(',');
    return discourseClient.getPosts(req.authUser.userId.toString(), req.params.topicId, postIds)
      .then((response) => {
        logger.info('Fetched posts from discourse');
        return adapter.adaptPosts(response.data)
      })
      .then(post => {
          return resp.status(200).send(util.wrapResponse(req.id, post));
      }).catch((error) => {
        logger.error('Error', error);
        logger.error(error.response && error.response.status);
        logger.error(error.response && error.response.data);
        next(new errors.HttpStatusError(error.response.status, 'Error fetching posts'));
      });
  }

}
