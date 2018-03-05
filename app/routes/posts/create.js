
const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Adapter = require('../../services/adapter');
const HelperService = require('../../services/helper');
const Joi = require('joi');
const { EVENT } = require('../../constants');

/**
 * Creates a new post to a topic in Discourse
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
  let userId = req.authUser.userId.toString();
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
      const postBody = req.body.post;
      const post = db.posts_backup.build({
        topicId,
        raw: req.body.post,
        postNumber: topic.highestPostNumber  + 1,
        viaEmail: false,
        hidden: false,
        reads: 0,
        createdAt: new Date(),
        createdBy: userId,
        updatedAt: new Date(),
        updatedBy: userId,
      })
      return post.save().then((savedPost) => {
        logger.info('post saved in Postgres');
        topic.highestPostNumber++;
        topic.save().then(() => logger.debug('topic updated async for post: ', savedPost.id));
        // creates an entry in post_user_stats table for tracking user actions against this post
        // right now it only creates entry for 'READ' action, in future we may create more entries
        // when we support more actions e.g. 'LIKE', 'BOOKMARK', 'FAVORITE' etc
        db.post_user_stats_backup.createStats(db, logger, {
          post : savedPost,
          userId,
          action: 'READ'
        }).then(() => logger.debug("post_user_stats entry created for post: ", savedPost.id));
        req.app.emit(EVENT.POST_CREATED, { post: savedPost, topic, req });
        return resp.status(200).send(util.wrapResponse(req.id, savedPost));
      })
    })
  })
  .catch((error) => {
    logger.error(error);
    next(new errors.HttpStatusError(error.response.status, 'Error creating post'));
  });
};
