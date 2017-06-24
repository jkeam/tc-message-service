
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Discourse = require('../../services/discourse');
const errors = require('common-errors');
const Adapter = require('../../services/adapter');
const Joi = require('joi');
const Promise = require('bluebird');

/**
 * Save a topic in Discourse
 * @param {Object} db sequelize db with models loaded
 * @return {object} response
 */
module.exports = db => (req, resp, next) => {
  const logger = req.log;
  const discourseClient = Discourse(logger);
  const adapter = new Adapter(logger, db);

  // Validate request parameters
  Joi.assert(req.body, {
    title: Joi.string().required(),
    postId: Joi.number().required(),
    content: Joi.string().required(),
  });
  const promises = [
    discourseClient.updateTopic(req.authUser.userId.toString(), req.params.topicId, req.body.title)
    .then((topicRes) => {
      logger.info('Topic saved', topicRes.data);
      return topicRes.data.basic_topic;
    }),
    discourseClient.updatePost(req.authUser.userId.toString(), req.body.postId, req.body.content)
    .then((postRes) => {
      logger.info('Topic Post saved', postRes.data);
      return adapter.adaptPost(postRes.data.post);
    }),
  ];
  return Promise.all(promises)
  .then(response => resp.status(200).send(util.wrapResponse(req.id, { topic: response[0], post: response[1] })))
  .catch((error) => {
    logger.error(error);
    next(new errors.HttpStatusError(
      error.response && error.response.status ? error.response.status : 500, 'Error updating topic'));
  });
};
