'use strict'

var _ = require('lodash');
var config = require('config');
var util = require('tc-core-library-js').util(config);
var Promise = require('bluebird');
var Discourse = require('../../services/discourse');
var errors = require('common-errors');
var Adapter = require('../../services/adapter');
var Joi = require('joi');

/**
 * Returns handle from @ mentions
 * match: @ mention
 */
function getHandleFromMatch(match) {
  return match.slice(2);
}

/**
 * Creates a new post to a topic in Discourse
 * db: sequelize db with models loaded
 */
module.exports = (db) => {
  return (req, resp, next) => {
    var logger = req.log
    var discourseClient = Discourse(logger);
    var adapter = new Adapter(logger, db);

    // Validate request parameters
    Joi.assert(req.body, {
      post: Joi.string().required()
    });
    var handleRex = / @([^\s]+)/g;
    var handles  = _.map(req.body.post.match(handleRex), getHandleFromMatch);
    var handleMap = {};
    return Promise.each(handles, (handle) => {
        return adapter.userIdLookup(handle).then((userId) => {
          if(userId){
            handleMap[handle] = userId.toString()
          } else {
            logger.error(`Cannot find user with userId ${userId}`);
          }
        })
      }).then(() => {
        var postBody = req.body.post.replace(handleRex, (match) => {
          var userId = handleMap[getHandleFromMatch(match)];
          if(userId){
            return ' @'  + userId;
          }
          return match;
        });
        return discourseClient.createPost(req.authUser.userId.toString(), postBody, req.params.topicId, req.body.responseTo).then((response) => {
        logger.info('Post created');
        var post =  adapter.adaptPost(response.data);
        return resp.status(200).send(util.wrapResponse(req.id, post));
      })
    }).catch((error) => {
      logger.error(error.response && error.response.status);
      logger.error(error.response && error.response.data);
      next(new errors.HttpStatusError(error.response.status, 'Error creating post'));
    });
  }

}
