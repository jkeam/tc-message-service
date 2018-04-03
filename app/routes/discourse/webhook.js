const Promise = require('bluebird');
const errors = require('common-errors');
const DynamoService = require('../../services/dynamodb');
const { EVENT, DISCOURSE_WEBHOOK_STATUS } = require('../../constants');
const Adapter = require('../../services/adapter');

/*
* Create standard log message for discource webhook.
*
* @param {String} message
* @param {Object} post
* @param {Object} savedPost saved by this service
* @returns {void}
*/
const createLogMessage = (message, post, savedPost = {}) =>
  `Discourse Webhook :: ${message}  -  {postId: ${post.id}, topicId: ${post.topic_id || post.topicId}, savedPostId: ${savedPost.id} }`

/*
* Sends 200 status. Sends back a success message to the webhook to indicate message received.
*
* @param {Object} resp the response
* @returns {void}
*/
const success = (resp) =>
  resp.status(200).send('OK');

/*
* Saves the post.
*   TODO: Currently duplicates a lot of functionality from routes/posts/create.js
*         In in the future, would want to combine these two in one place and remove
*         the logic that is essentially in the controller/route handler. And based
*         on the failure/success conditions have routes/posts/create.js return the
*         correct HTTPStatus code.  This webhook is unconcerned with returning the
*         correct HTTPStatus code as an error code (400 - 500) in most systems
*         usually indicates a failure to send and results in an exponential backoff
*         webhook retry.
*
* @param {Object} req the request
* @param {Object} db the database
* @param {Object} post the raw post to save
* @returns {Object} promise that will resolve when the post is saved
*/
const savePost = (req, db, post) => {
  const logger = req.log;
  const adapter = new Adapter(logger, db);
  return new Promise((resolve, reject) => {
    db.topics.findById(post.topic_id)
      .then((topic) => { /* eslint no-param-reassign: ["error", { "props": true, "ignorePropertyModificationsFor": ["topic"] }] */
        if (topic) {
          db.posts.createPost(db, post.cooked, topic, post.user_id).then((savedPost) => {
            logger.debug(createLogMessage('Post created via discourse webhook.', post));
            topic.highestPostNumber += 1;
            topic.save().then(() => logger.debug(createLogMessage('Topic updated async for post.', post, savedPost)));
            db.post_user_stats.createStats(db, logger, {
              post: savedPost,
              userId: post.user_id,
              action: 'READ',
            }).then(() => logger.debug(createLogMessage('post_user_stats entry created for post.', post, savedPost)));
            adapter.adaptPost(savedPost)
              .then((post) => {
                req.app.emit(EVENT.POST_CREATED, { post: savedPost, topic, req });
                resolve(post);
              }).catch((e) => {
                reject(createLogMessage('Unable to adapt post for emit.', post));
              });
          });
        } else {
          reject(createLogMessage('No topic found.', post));
        }
      }).catch((e) => {
        reject(createLogMessage('Error while finding topic.', post));
      });
  });
};

/**
 * Discourse webhook callback
 *
 * @param {Object} db the database
 * @returns {Function} response function to be used next in the processing chain
 */
module.exports = db => (req, resp, next) => {
  const logger = req.log;
  const post = req.body.post;
  const originalPostId = post.id;
  return DynamoService.save(post).then((data) => {
    logger.debug(createLogMessage('Initial loading of post from discourse webhook successful.', post));
    return savePost(req, db, post).then((savedPost) => {
      DynamoService.updateStatus(post.id, DISCOURSE_WEBHOOK_STATUS.COMPLETED).then((data) => {
        logger.info(createLogMessage('Completed post processing from discourse webhook.', post, savedPost));
      }).catch((e) => {
        logger.error(createLogMessage('Unable to mark post from discourse webhook as completed.', post));
      }).finally(() => success(resp));
    }).catch((errorMessage) => {
      logger.error(errorMessage);
      return DynamoService.updateStatus(originalPostId, DISCOURSE_WEBHOOK_STATUS.ERROR).finally(() => success(resp));
    });
  }).catch((e) => {
    logger.error(createLogMessage('Initial loading of post from discourse webhook not successful.', post));
    logger.error(e);
  });
};
