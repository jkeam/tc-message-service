

const config = require('config');
const util = require('tc-core-library-js').util(config);
const Discourse = require('../../services/discourse');
const errors = require('common-errors');
const Adapter = require('../../services/adapter');

/**
 * Creates a new post to a topic in Discourse
 * @param {Object} db sequelize db with models loaded
 * @return {Object} response
 */
module.exports = db => (req, resp, next) => {
  const logger = req.log;
  const discourseClient = Discourse(logger);
  const adapter = new Adapter(logger, db);

  if (!req.query.postIds) {
    return resp.status(400).send('Post ids parameter is required');
  }

  const postIds = req.query.postIds.split(',');
  return discourseClient.getPosts(req.authUser.userId.toString(), req.params.topicId, postIds)
      .then((response) => {
        logger.info('Fetched posts from discourse');
        return adapter.adaptPosts(response.data);
      })
      .then(post => resp.status(200).send(util.wrapResponse(req.id, post))).catch((error) => {
        logger.error('Error', error);
        logger.error(error.response && error.response.status);
        logger.error(error.response && error.response.data);
        next(new errors.HttpStatusError(error.response.status, 'Error fetching posts'));
      });
};
