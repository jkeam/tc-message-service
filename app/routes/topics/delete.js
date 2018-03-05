
import HelperService from '../../services/helper';
const config = require('config');
const util = require('tc-core-library-js').util(config);
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
  const helper = HelperService(logger, db);

  // Validate request parameters
  Joi.assert(req.params, {
    topicId: Joi.number().required(),
  });
  const topicId = req.params.topicId;
  const userId = req.authUser.userId.toString();
  return db.topics_backup.findById(topicId)
  .then((topic) => {
    if (!topic) {
      const err = new errors.HttpStatusError(404, 'Topic does not exist');
      return next(err);
    }
    return helper.callReferenceEndpoint(req.authToken, req.id, topic.reference, topic.referenceId)
    .then((hasAccessResp) => {
      const hasAccess = helper.userHasAccessToEntity(userId, hasAccessResp, topic.reference);
      if (!hasAccess && !helper.isAdmin(req)) {
        throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
      }
      return db.posts_backup.getPostsCount(topic.id)
      .then((totalPosts) => {
        if (totalPosts > 1) {
          throw new errors.HttpStatusError(422, 'Topic has comments and can not be deleted');
        }
        topic.deletedAt = new Date();
        topic.deletedBy = userId;
        topic.save().then(() => {
          req.app.emit(EVENT.TOPIC_DELETED, { topic, req });
          resp.status(200).send(util.wrapResponse(req.id));
        });
      });
    });
  })
  .catch((error) => {
    logger.error(error);
    next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(
      error.response && error.response.status ? error.response.status : 500, 'Error deleting topic'));
  });
};
