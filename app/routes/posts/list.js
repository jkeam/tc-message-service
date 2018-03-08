import HelperService from '../../services/helper';

const _ = require('lodash');
const config = require('config');
const util = require('tc-core-library-js').util(config);
const errors = require('common-errors');
const Sequelize = require('sequelize');
const Adapter = require('../../services/adapter');

const Op = Sequelize.Op;
/**
 * Get posts for the given topic
 * @param {Object} db sequelize db with models loaded
 * @return {Object} response
 */
module.exports = db => (req, resp, next) => {
  const logger = req.log;
  const helper = HelperService(logger, db);
  const adapter = new Adapter(logger, db);

  const topicId = req.params.topicId;
  // TODO validation for topic id
  const postIds = req.query.postIds ? req.query.postIds.split(',') : null;

  if (!postIds) {
    return next(new errors.HttpStatusError(400, 'postIds required'));
  }

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

      const filter = {};
      filter.topicId = Number(req.params.topicId);
      if (postIds) {
        filter.id = { [Op.in]: postIds.map(pid => Number(pid)) };
      }
      return db.posts_backup.findPosts(adapter, filter)
      .then((posts) => {
        if (posts && posts.length > 0) {
          // marks each post a read for the request user, however, ideally they should be marked
          // as read only after user has actually seen them in UI because UI might not be showing all posts
          // at once
          db.post_user_stats_backup.updateUserStats(db, logger, posts, userId, 'READ');
        }
        // posts.map(post => db.posts_backup.increaseReadCount(db, logger, post, userId));
        return resp.status(200).send(util.wrapResponse(req.id, (posts || [])));
      });
    })
    .catch((error) => {
      logger.error(error);
      if (error.statusCode) {
        return next(error);
      }
      return next(new errors.HttpStatusError(_.get(error, 'response.status', 500), 'Error fetching post'));
    });
  });
};
