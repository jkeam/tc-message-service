const Promise = require('bluebird');
const errors = require('common-errors');
const DynamoService = require('../../services/dynamodb');
const { EVENT, DISCOURSE_WEBHOOK_STATUS } = require('../../constants');
const Adapter = require('../../services/adapter');

/*
* Create standard log message for post discource webhook.
*
* @param {String} message
* @param {Object} post
* @param {Object} savedPost saved by this service
* @returns {void}
*/
const createPostLogMessage = (message, post, savedPost = {}) =>
  `Discourse Webhook :: ${message}  -  { postId: ${post.id}, topicId: ${post.topic_id || post.topicId}, savedPostId: ${savedPost.id} }`

/*
* Create standard log message for topic discource webhook.
*
* @param {String} message
* @param {Object} topic
* @param {Object} savedTopic saved by this service
* @returns {void}
*/
const createTopicLogMessage = (message, topic, savedTopic = {}) =>
  `Discourse Webhook :: ${message}  -  { topicId: ${topic.id}, savedTopicId: ${savedTopic.id} }`

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
* @param {Object} db the database
* @param {Object} req the request
* @param {Object} resp the response
* @param {Object} post the raw post to save
* @param {Function} formatMessage function to format the log message
* @returns {Object} promise that will resolve when the post is saved
*/
const savePost = (db, req, resp, post, formatMessage) => {
  const logger = req.log;
  const adapter = new Adapter(logger, db);
  const userId = post.user_id;
  return new Promise((resolve, reject) => {
    db.topics.findById(post.topic_id)
      .then((topic) => { /* eslint no-param-reassign: ["error", { "props": true, "ignorePropertyModificationsFor": ["topic"] }] */
        if (topic) {
          db.posts.createPost(db, post.cooked, topic, userId).then((savedPost) => {
            logger.debug(formatMessage('Post created via discourse webhook.', post));
            topic.highestPostNumber += 1;
            topic.save().then(() => logger.debug(formatMessage('Topic updated async for post.', post, savedPost)));
            db.post_user_stats.createStats(db, logger, {
              post: savedPost,
              userId: post.user_id,
              action: 'READ',
            }).then(() => logger.debug(formatMessage('post_user_stats entry created for post.', post, savedPost)));
            adapter.adaptPost(savedPost)
              .then((adaptedPost) => {
                req.app.emit(EVENT.POST_CREATED, {
                  post: {
                    topicId: post.topic_id,
                    id: post.id,
                    postContent: post.raw
                  },
                  topic,
                  req: {
                    authUser: {
                      userId
                    }
                  }
                });
                resolve(adaptedPost);
              }).catch((e) => {
                logger.error(e);
                reject(formatMessage('Unable to adapt post for emit.', post, savedPost));
              });
          });
        } else {
          reject(formatMessage('No topic found.', post));
        }
      }).catch((e) => {
        reject(formatMessage('Error while finding topic.', post));
      });
  });
};

/*
* Saves the topic.
*   TODO: Currently duplicates a lot of functionality from routes/topic/create.js
*         In in the future, would want to combine these two in one place and remove
*         the logic that is essentially in the controller/route handler. And based
*         on the failure/success conditions have routes/topic/create.js return the
*         correct HTTPStatus code.  This webhook is unconcerned with returning the
*         correct HTTPStatus code as an error code (400 - 500) in most systems
*         usually indicates a failure to send and results in an exponential backoff
*         webhook retry.
*
* @param {Object} db the database
* @param {Object} req the request
* @param {Object} resp the response
* @param {Object} topic the raw topic to save
* @param {Function} formatMessage function to format the log message
* @returns {Object} promise that will resolve when the topic is saved
*/
const saveTopic = (db, req, resp, topic, formatMessage) => {
  const logger = req.log;
  const adapter = new Adapter(logger, db);

  const userId = topic.user_id;
  const pgTopic = {
    reference: 'project',
    referenceId: 'referenceId',
    title: topic.title,
  };

  return new Promise((resolve, reject) => {
    db.topics.createTopic(db, pgTopic, userId)
      .then((savedTopic) => { /* eslint no-param-reassign: ["error", { "props": true, "ignorePropertyModificationsFor": ["savedTopic"] }] */
        req.app.emit(EVENT.TOPIC_CREATED, { topic: pgTopic, req: { authUser: { userId } } });
        logger.debug(formatMessage('Topic saved in Postgres.', topic, savedTopic));
        DynamoService.findByTopicIdAndType(topic.id, 'post').then((data) => {
          if (data.Items) {
            data.Items.map(post => post['Id']['S']).forEach((postId) => {
              DynamoService.findById(postId).then((post) => {
                process(db, req, resp, null, Object.assign({}, post, {topic_id: savedTopic.id}));
              }).catch((e) => {
                logger.warn(formatMesage('Unable to save post for topic', topic));
                logger.warn(e);
              })
            });
          }
          resolve(savedTopic);
        }).catch((error) => {
          logger.error(formatMessage(error, topic));
          logger.debug(formatMessage('Unable to fetch posts for new topic.', topic, savedTopic));
          resolve(savedTopic);
        });
      }).catch((errorMessage) => {
        logger.error(formatMessage(errorMessage, topic));
        reject(formatMessage('Error while saving topic.', topic));
      });
  });
};

/*
* Process the topic or post from the discourse webhook.
*
* @param {Object} db the database
* @param {Object} req the request
* @param {Object} resp the response
* @param {Object} topic the raw topic to save
* @param {Object} post the raw post to save
* @returns {Object} promise that will resolve when the topic is saved
*/
const process = (db, req, resp, topic, post) => {
  const logger = req.log;

  // objects
  const obj = topic || post;
  const type = topic ? 'topic' : 'post';

  // ids
  const id = `${type}_${obj.id}`;
  const topicId = topic ? topic.id : post.topic_id;

  // specific functions
  const formatMessage = topic ? createTopicLogMessage : createPostLogMessage;
  const save = topic ? saveTopic : savePost;

  return DynamoService.findOrCreate(id, topicId, type, obj).then((data) => {
    logger.debug(formatMessage(`Initial loading of ${type} from discourse webhook successful.`, obj));
    return save(db, req, resp, obj, formatMessage).then((saved) => {
      return DynamoService.updateStatus(id, DISCOURSE_WEBHOOK_STATUS.COMPLETED).then((data) => {
        return DynamoService.updateNewId(id, saved.id).then((data) => {
          logger.info(formatMessage(`Completed ${type} processing from discourse webhook.`, obj, saved));
        }).catch((e) => {
          logger.error(formatMessage(`Unable to update ${type} from discourse webhook with new id.`, obj));
          logger.error(e);
        })
      }).catch((e) => {
        logger.error(formatMessage(`Unable to mark ${type} from discourse webhook as completed.`, obj));
        logger.error(e);
      });
    }).catch((errorMessage) => {
      logger.error(errorMessage);
      return DynamoService.updateStatus(id, DISCOURSE_WEBHOOK_STATUS.ERROR);
    });
  }).catch((e) => {
    logger.error(formatMessage(`Initial loading of ${type} from discourse webhook not successful.`, obj));
    logger.error(e);
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
  const topic = req.body.topic;

  if (topic || post) {
    return process(db, req, resp, topic, post).finally(() => success(resp));
  } else {
    logger.warn('Unable to process discourse webhook', req);
    return Promise.resolve();
  }
};
