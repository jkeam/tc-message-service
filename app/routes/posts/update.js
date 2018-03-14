
import HelperService from '../../services/helper';

const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Adapter = require('../../services/adapter');
const Joi = require('joi');
const { EVENT } = require('../../constants');
const Promise = require('bluebird');

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

  const promises = [
    db.topics_backup.findTopic(db, adapter, { topicId, raw: true }),
    db.posts_backup.findPost(db, adapter, { topicId, postId, raw: true }),
  ];
  return Promise.all(promises)
  .then(([topic, post]) => {
    if (!topic) {
      const err = new errors.HttpStatusError(404, 'Topic does not exist');
      return next(err);
    }
    if (!post) {
      const err = new errors.HttpStatusError(404, 'Post does not exist');
      return next(err);
    }
    return helper.callReferenceEndpoint(req.authToken, req.id, topic.reference, topic.referenceId)
    .then((hasAccessResp) => {
      const hasAccess = helper.userHasAccessToEntity(userId, hasAccessResp, topic.reference);
      if (!hasAccess && !helper.isAdmin(req)) {
        throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
      }

      return db.posts_backup.updatePost(db, adapter, { raw: content }, { postId, reqUserId: userId })
      .then((updatedPost) => {
        req.app.emit(EVENT.POST_UPDATED, { post, req, topic });
        resp.status(200).send(util.wrapResponse(req.id, updatedPost));
      });
    });
  })
  .catch((error) => {
    logger.error(error);
    next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(500, 'Error updating post'));
  });
};
