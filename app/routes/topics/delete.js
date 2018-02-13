
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Discourse = require('../../services/discourse');
const errors = require('common-errors');
const Joi = require('joi');
const Promise = require('bluebird');
const { EVENT } = require('../../constants');

/**
 * Delete a topic from Discourse and Postgresql
 * @param {Object} db sequelize db with all models loaded
 * @return {object} response
 */
module.exports = db => (req, resp, next) => {
  const logger = req.log;
  const discourseClient = Discourse(logger);

  // Validate request parameters
  Joi.assert(req.params, {
    topicId: Joi.number().required(),
  });
  const topicId = req.params.topicId;
  const username = req.authUser.userId.toString();
  const promises = [
    db.topics.findOne({ where: { discourseTopicId: topicId } }),
    discourseClient.getTopics([topicId], username).then((topics) => {
      logger.info('got topics: ', topics);
      if (topics.length < 1) {
        return null;
      }
      return topics[0];
    }),
  ];
  return Promise.all(promises)
  .then((response) => {
    const dbTopic = response[0];
    const topic = response[1];
    if (!dbTopic && !topic) {
      throw new errors.HttpStatusError(404, 'Topic does not exist');
    }
    if (topic && topic.posts.length > 1) {
      throw new errors.HttpStatusError(422, 'Topic has comments and can not be deleted');
    }
    const deletePromises = [];
    if (topic) {
      deletePromises.push(discourseClient.deleteTopic(username, topicId));
    } else {
      logger.warn('Topic does not exist in discourse, maybe already deleted');
    }
    if (dbTopic) {
      deletePromises.push(dbTopic.destroy());
    } else {
      logger.warn('Topic does not exist in postgresql, maybe already deleted');
    }

    req.app.emit(EVENT.TOPIC_DELETED, { topic: dbTopic, req });

    return Promise.all(deletePromises);
  })
  .then(() => {
    logger.info('Topic deleted');
    resp.status(200).send(util.wrapResponse(req.id));
  })
  .catch((error) => {
    logger.error(error);
    next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(
      error.response && error.response.status ? error.response.status : 500, 'Error deleting topic'));
  });
};
