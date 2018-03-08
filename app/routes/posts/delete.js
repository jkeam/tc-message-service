
const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Joi = require('joi');
const { EVENT } = require('../../constants');
const HelperService = require('../../services/helper');

/**
 * Delete a post in Discourse
 * @param {Object} db sequelize db with models loaded
 * @return {Object} response
 */
module.exports = db => (req, resp, next) => {
  const logger = req.log;
  const helper = HelperService(logger, db);

  // Validate request parameters
  Joi.assert(req.params, {
    topicId: Joi.number().required(),
    postId: Joi.number().required(),
  });
  const topicId = req.params.topicId;
  const postId = req.params.postId;
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
      return db.posts_backup.update({
        deletedAt: new Date(),
        deletedBy: userId,
      }, { where: { id: postId } })
      .then(() => {
        logger.info('Post deleted');
        req.app.emit(EVENT.POST_DELETED, { req, topic });
        resp.status(200).send(util.wrapResponse(req.id));
      })
      .catch((error) => {
        logger.error(error);
        next(new errors.HttpStatusError(
          error.response && error.response.status ? error.response.status : 500, 'Error deleting post'));
      });
    });
  });
};
