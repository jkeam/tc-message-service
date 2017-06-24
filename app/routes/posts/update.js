
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Discourse = require('../../services/discourse');
const errors = require('common-errors');
const Adapter = require('../../services/adapter');
const Joi = require('joi');

/**
 * Save a post to a topic in Discourse
 * @param {Object} db sequelize db with models loaded
 * @return {object} response
 */
module.exports = db => (req, resp, next) => {
  const logger = req.log;
  const discourseClient = Discourse(logger);
  const adapter = new Adapter(logger, db);

  // Validate request parameters
  Joi.assert(req.body, {
    post: Joi.string().required(),
  });
  const postBody = req.body.post;
  return discourseClient.updatePost(
    req.authUser.userId.toString(),
    req.params.postId,
    postBody)
  .then((response) => {
    logger.info('Post saved', response.data);
    return adapter.adaptPost(response.data.post);
  })
  .then(post => resp.status(200).send(util.wrapResponse(req.id, post)))
  .catch((error) => {
    logger.error(error);
    next(new errors.HttpStatusError(
      error.response && error.response.status ? error.response.status : 500, 'Error updating post'));
  });
};
