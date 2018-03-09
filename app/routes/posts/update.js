
import HelperService from '../../services/helper';

const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Adapter = require('../../services/adapter');
const Joi = require('joi');
const { EVENT } = require('../../constants');

/**
 * Save a post to a topic
 * @param {Object} db sequelize db with models loaded
 * @return {object} response
 */
module.exports = db => (req, resp, next) => {
  const logger = req.log;
  const adapter = new Adapter(logger, db);
  const helper = HelperService(logger, db);

  // Validate request parameters
  Joi.assert(req.body, {
    post: Joi.string().required(),
  });

  const topicId = req.params.topicId;
  const postId = req.params.postId;
  const content = req.body.post;
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

      return db.posts_backup.findById(postId)
      .then((post) => { /* eslint no-param-reassign: ["error", { "props": true, "ignorePropertyModificationsFor": ["post"] }] */
        post.raw = content;
        post.updatedBy = userId;
        return post.save().then(savedPost => adapter.adaptPost(savedPost));
      })
      .then((post) => {
        req.app.emit(EVENT.POST_UPDATED, { post, req, topic });
        resp.status(200).send(util.wrapResponse(req.id, post));
      });
    });
  })
  .catch((error) => {
    logger.error(error);
    next(new errors.HttpStatusError(
      error.response && error.response.status ? error.response.status : 500, 'Error updating post'));
  });
};
