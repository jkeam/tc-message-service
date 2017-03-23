

const _ = require('lodash');
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Promise = require('bluebird');
const Discourse = require('../../services/discourse');
const errors = require('common-errors');
const Adapter = require('../../services/adapter');
const Joi = require('joi');
const HelperService = require('../../services/helper');

/**
 * Creates a new post to a topic in Discourse
 * @param {Object} db sequelize db with models loaded
 * @return {object} response
 */
module.exports = db => (req, resp, next) => {
  const logger = req.log;
  const discourseClient = Discourse(logger);
  const adapter = new Adapter(logger, db);
  const helper = HelperService(logger, db);

    // Validate request parameters
  Joi.assert(req.body, {
    post: Joi.string().required(),
  });
  const handleRex = / @([^\s]+)/g;
  const handles = _.map(req.body.post.match(handleRex), helper.getContentFromMatch);
  const handleMap = {};
  return Promise.each(handles, handle => adapter.userIdLookup(handle).then((userId) => {
    if (userId) {
      handleMap[handle] = userId.toString();
    } else {
      logger.error(`Cannot find user with handle ${handle}`);
    }
  })).then(() => {
    const postBody = req.body.post.replace(handleRex, (match) => {
      const userId = handleMap[helper.getContentFromMatch(match)];
      if (userId) {
        return ` @${userId}`;
      }
      return match;
    });
    return discourseClient.createPost(
      req.authUser.userId.toString(),
      postBody, req.params.topicId,
      req.body.responseTo)
      .then((response) => {
        logger.info('Post created');
        return adapter.adaptPost(response.data)
            .then(post => resp.status(200).send(util.wrapResponse(req.id, post)));
      });
  }).catch((error) => {
    logger.error(error.response && error.response.status);
    logger.error(error.response && error.response.data);
    next(new errors.HttpStatusError(error.response.status, 'Error creating post'));
  });
};
