
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Discourse = require('../../services/discourse');
const errors = require('common-errors');
const Joi = require('joi');
const { EVENT } = require('../../constants');

/**
 * Delete a post in Discourse
 * @return {Object} response
 */
module.exports = () => (req, resp, next) => {
  const logger = req.log;
  const discourseClient = Discourse(logger);

  // Validate request parameters
  Joi.assert(req.params, {
    topicId: Joi.number().required(),
    postId: Joi.number().required(),
  });
  return discourseClient.deletePost(
    req.authUser.userId.toString(),
    req.params.postId)
  .then(() => {
    logger.info('Post deleted');
    req.app.emit(EVENT.POST_DELETED, { req });
    resp.status(200).send(util.wrapResponse(req.id));
  })
  .catch((error) => {
    logger.error(error);
    next(new errors.HttpStatusError(
      error.response && error.response.status ? error.response.status : 500, 'Error deleting post'));
  });
};
