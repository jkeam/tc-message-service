

const _ = require('lodash');
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Promise = require('bluebird');
const Discourse = require('../../services/discourse');
const HelperService = require('../../services/helper');
const errors = require('common-errors');
const Joi = require('joi');
const Adapter = require('../../services/adapter');
const { REFERENCE_LOOKUPS, EVENT } = require('../../constants');

const DISCOURSE_SYSTEM_USERNAME = config.get('discourseSystemUsername');
  /**
   * Handles creation of topics
   * @param {Object} db sequelize db with all models loaded
   * @return {Object} response object
   */
module.exports = db =>

  /**
   * Create a new topic for the specified entity.
   *  - Verify if the user has access to the entity (userHasAccessToEntity function), if the user doesn't have access return 403;
   *  - Try to create a private message in Discourse (createPrivatePost in discourse.js);
   *  - If it fails, check if the user exists in Discourse, if the user doesn't exist, provision it, and try to create the private message again;
   *  - Set system, and the current user as the users in the post;
   *  - Return the newly created topic.
   * params: standard express parameters
   */
   (req, resp, next) => {
     const logger = req.log;
     const discourseClient = Discourse(logger);
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

     return helper.userHasAccessToEntity(req.authToken, req.id, params.reference, params.referenceId)
      .then((hasAccessResp) => {
        logger.info('Checking if user has access to identity');
        const hasAccess = hasAccessResp[0];
        if (!hasAccess) { throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity'); }
        if (params.reference.toLowerCase() === REFERENCE_LOOKUPS.PROJECT) {
          const projectMembers = _.get(hasAccessResp[1], 'members', []);
            // get users list
          const topicUsers = _.map(projectMembers, member => member.userId.toString());
          return topicUsers;
        }
        return new Promise.resolve([req.authUser.userId.toString()]); // eslint-disable-line
      }).then((users) => {
        logger.info('User has access to entity, creating topic in Discourse');
        // add system user
        users.push(DISCOURSE_SYSTEM_USERNAME);
        logger.debug('Users that suppose to be in the topic: ', users);

        return helper.getEntityGroupAndCategoryOrProvision(params.reference, params.referenceId, users)
          .then((referenceGroupCategory) => {
            logger.info('Creating topic...');

            return discourseClient
              .createTopic(params.title, params.body, req.authUser.userId.toString(), referenceGroupCategory.categoryId)
              .catch((error) => {
                logger.error('Failed to create topic', error);
                if (error.status || (error.response && error.response.status)) {
                  const message = _.get(error, 'response.data.errors[0]') || error.message;
                  throw new errors.HttpStatusError(
                    error.status || error.response.status,
                    `Failed to create topic in Discourse: ${message}`);
                }
                throw new errors.HttpStatusError(500,
                  `Failed to create topic in Discourse: ${error.message}`);
              });
          });
      }).then((response) => {
        logger.debug(response.data);

        const pgTopic = db.topics.build({
          reference: params.reference,
          referenceId: params.referenceId,
          discourseTopicId: response.data.topic_id,
          tag: params.tag,
          createdAt: new Date(),
          createdBy: req.authUser.userId.toString(),
          updatedAt: new Date(),
          updatedBy: req.authUser.userId.toString(),
          isPrivateMessage: false, // mark that this topic is handled not using private messages, but categories
        });

        return pgTopic.save().then(() => {
          logger.info('topic saved in Postgres');
          req.app.emit(EVENT.TOPIC_CREATED, { topic: pgTopic, req });
          return { topic: response.data, dbTopic: pgTopic };
        });
      })
      .then(({ topic, dbTopic }) => {
        logger.info('returning topic');
        return discourseClient.getTopics([topic.topic_id], req.authUser.userId.toString())
        .then((fTopic) => {
          const fullTopic = fTopic[0];
          fullTopic.tag = params.tag;
          return resp.status(200).send(util.wrapResponse(req.id, adapter.adaptTopic({ topic: fullTopic, dbTopic })));
        });
      })
      .catch(error => next(error));
   };
