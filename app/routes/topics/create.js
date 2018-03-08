

const _ = require('lodash');
const config = require('config');
const util = require('tc-core-library-js').util(config);
const HelperService = require('../../services/helper');
const errors = require('common-errors');
const Joi = require('joi');
const Adapter = require('../../services/adapter');
const { EVENT } = require('../../constants');

/**
 * Handles creation of topics
 * @param {Object} db sequelize db with all models loaded
 * @return {Object} response object
 */
module.exports = db =>

  /**
   * Create a new topic for the specified entity.
   *  - Verify if the user has access to the entity (callReferenceEndpoint function), if the user doesn't have access return 403;
   *  - Try to create a private message in Discourse (createPrivatePost in discourse.js);
   *  - If it fails, check if the user exists in Discourse, if the user doesn't exist, provision it, and try to create the private message again;
   *  - Set system, and the current user as the users in the post;
   *  - Return the newly created topic.
   * params: standard express parameters
   */
  (req, resp, next) => {
    const logger = req.log;
    const helper = HelperService(logger, db);
    const adapter = new Adapter(logger, db);

    const params = req.body;

    // Validate request parameters
    Joi.assert(params, {
      reference: Joi.string().required(),
      referenceId: Joi.string().required(),
      tag: Joi.string().required(),
      title: Joi.string().required(),
      body: Joi.string().required(),
    });

    const userId = req.authUser.userId.toString();
    return helper.callReferenceEndpoint(req.authToken, req.id, params.reference, params.referenceId)
      .then((hasAccessResp) => {
        const hasAccess = helper.userHasAccessToEntity(userId, hasAccessResp, params.reference);
        // if (!hasAccess && !helper.isAdmin(req)) {
        if (!hasAccess) { // even admins are not allowed to create a topic in a project where they are not member
          throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
        }
        const pgTopic = {
          reference: params.reference,
          referenceId: params.referenceId,
          title: params.title,
          tag: params.tag,
        };

        return db.topics_backup.createTopic(db, pgTopic, userId).then((savedTopic) => { /* eslint no-param-reassign: ["error", { "props": true, "ignorePropertyModificationsFor": ["savedTopic"] }] */
          logger.debug('topic saved in Postgres: ', savedTopic);
          const post = db.posts_backup.build({
            topicId: savedTopic.id,
            raw: params.body,
            postNumber: 1,
            viaEmail: false,
            hidden: false,
            reads: 0,
            createdAt: new Date(),
            createdBy: userId,
            updatedAt: new Date(),
            updatedBy: userId,
          });
          return post.save().then((savedPost) => {
            logger.info('post saved in Postgres');
            savedTopic.posts = [savedPost];
            req.app.emit(EVENT.TOPIC_CREATED, { topic: savedTopic, req });
            return resp.status(200).send(util.wrapResponse(req.id, adapter.adaptTopic({ dbTopic: savedTopic })));
          });
        });
      }).catch((error) => {
        logger.error('Failed to create topic', error);
        if (error.statusCode) {
          return next(error);
        }
        return next(new errors.HttpStatusError(_.get(error, 'response.status', 500), 'Error creating topic'));
      })
      .catch(error => next(error));
  };
