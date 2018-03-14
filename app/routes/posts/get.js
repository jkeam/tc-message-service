import HelperService from '../../services/helper';

const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Adapter = require('../../services/adapter');

/**
 * Get posts from database
 * @param {Object} db sequelize db with models loaded
 * @return {Object} response
 */
module.exports = db => (req, resp, next) => {
  const logger = req.log;
  const helper = HelperService(logger, db);
  const adapter = new Adapter(logger, db);
  const topicId = req.params.topicId;
  const postId = req.params.postId;

  // Get the posts as the system user if the logged is user is an admin
  const userId = req.authUser.userId.toString();
  return db.topics_backup.findOne({ where: { id: topicId }, raw: true })
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
      return db.posts_backup.findPost(db, adapter, { topicId, postId, raw: true })
      .then((post) => {
        if (!post) {
          throw new errors.HttpStatusError(404, 'Post does not exist');
        }
        logger.debug('Fetched post', post);
        // marks each post a read for the request user, however, ideally they should be marked
        // as read only after user has actually seen them in UI because UI might not be showing all posts
        // at once
        db.post_user_stats_backup.updateUserStats(db, logger, [post], userId, 'READ');
        // return adapter.adaptPost(response);
        return post;
      })
      .then(post => resp.status(200).send(util.wrapResponse(req.id, post)));
    });
  })
  .catch((error) => {
    logger.error(error);
    next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(500, 'Error fetching post'));
  });
};
