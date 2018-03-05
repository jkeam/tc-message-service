
import HelperService from '../../services/helper';
const config = require('config');
const util = require('tc-core-library-js').util(config);
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
  const adapter = new Adapter(logger, db);
  const helper = HelperService(logger, db);

  // Validate request parameters
  Joi.assert(req.body, {
    title: Joi.string().required(),
    postId: Joi.number().required(),
    content: Joi.string().required(),
  });
  const topicId = req.params.topicId;
  const postId  = req.body.postId;
  const title   = req.body.title;
  const content = req.body.content;
  let userId    = req.authUser.userId.toString();

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
      topic.title = title;
      topic.updatedBy = userId;
      // topic.updatedAt = new Date();
      const promises = [
        topic.save().then((updatedTopic) => {
          logger.info('Topic saved', updatedTopic);
          return updatedTopic;
        }),
        db.posts_backup.findById(postId)
        .then(post => {
          post.raw = content;
          post.updatedBy = userId;
          // post.updatedAt = new Date();
          return post.save();
        })
        .then((updatedPost) => {
          logger.info('Topic Post saved', updatedPost);
          return updatedPost;
        }),
      ];
      return Promise.all(promises)
      .then(response => resp.status(200).send(util.wrapResponse(req.id, { topic: response[0], post: response[1] })))
      .catch((error) => {
        logger.error(error);
        next(new errors.HttpStatusError(
          error.response && error.response.status ? error.response.status : 500, 'Error updating topic'));
      });
    });
  });
};
