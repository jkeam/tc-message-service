
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Discourse = require('../../services/discourse');
const errors = require('common-errors');
const Adapter = require('../../services/adapter');
const Joi = require('joi');
const { EVENT } = require('../../constants');

/**
 * Creates a new post to a topic in Discourse
 * @param {Object} db sequelize db with models loaded
 * @return {object} response
 */
module.exports = db => (req, resp, next) => {
  const logger = req.log;
  const discourseClient = Discourse(logger);
  const adapter = new Adapter(logger, db);
  // const helper = HelperService(logger, db);

    // Validate request parameters
  Joi.assert(req.body, {
    post: Joi.string().required(),
  });
  const postBody = req.body.post;
  return discourseClient.createPost(
    req.authUser.userId.toString(),
    postBody,
    req.params.topicId,
    req.body.responseTo)
  .then((response) => {
    logger.info('Post created');
    return adapter.adaptPost(response.data);
  })
  .then((post) => {
    req.app.emit(EVENT.POST_CREATED, { post, req });
    resp.status(200).send(util.wrapResponse(req.id, post));
  })
  .catch((error) => {
    logger.error(error);
    next(new errors.HttpStatusError(error.response.status, 'Error creating post'));
  });
};
