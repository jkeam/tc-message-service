

const _ = require('lodash');
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Promise = require('bluebird');
const Discourse = require('../../services/discourse');
const HelperService = require('../../services/helper');
const errors = require('common-errors');
const Joi = require('joi');
const Adapter = require('../../services/adapter');


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
        if (params.reference.toLowerCase() === 'project') {
          const projectMembers = _.get(hasAccessResp[1], 'members', []);
            // get users list
          const topicUsers = _.map(projectMembers, member => member.userId.toString());
          logger.debug(topicUsers);
          return topicUsers;
        }
        return new Promise.resolve([req.authUser.userId.toString()]); // eslint-disable-line
      }).then((users) => {
        logger.info('User has access to entity, creating topic in Discourse');
        // add system user
        users.push(DISCOURSE_SYSTEM_USERNAME);
        logger.debug('Users that should be added to topic: ', users);
        return discourseClient
          .createPrivatePost(params.title, params.body, users.join(','), req.authUser.userId.toString())
          .then(response => response).catch((error) => {
            // logger.debug('Error creating private post', error);
            // logger.debug(error.response && error.response.status);
            // logger.debug(error.response && error.response.data);
            logger.info('Failed to create topic in Discourse');
            logger.error(error);

            // If 403 or 422, it is possible that the user simply hasn't been created in Discourse yet
            if (error.response &&
              (error.response.status === 500 || error.response.status === 403 || error.response.status === 422)) {
              logger.info('Failed to create topic in Discourse, checking user exists in Discourse and provisioning');
              const getUserPromises = _.map(users, (user) => {
                if (user !== DISCOURSE_SYSTEM_USERNAME) {
                  return helper.getUserOrProvision(user);
                }
                return new Promise.resolve(); // eslint-disable-line
              });
              return Promise.all(getUserPromises).then(() => {
                logger.info('User(s) exists in Discourse, trying to create topic again');
                return Promise.coroutine(function* a() {
                  // createPrivatePost may fail again if called too soon. Trying over and over again until success or timeout
                  const endTimeMs = new Date().getTime() + config.get('createTopicTimeout');
                  const delayMs = config.get('createTopicRetryDelay');
                  for (let i = 1; ; ++i) {
                    try {
                      logger.debug(`attempt number ${i}`);
                      // We need update post body for subsequent tries, otherwise system user posts fail - DISCOURSE !
                      params.body += ' ';
                      return yield discourseClient
                        .createPrivatePost(params.title, params.body, users.join(','), req.authUser.userId.toString());
                    } catch (e) {
                      if (e.response && (e.response.status === 403 || e.response.status === 422)) {
                        logger.debug(`Failed to create create private post. (attempt #${i}, e: ${e})`);
                        logger.debug(e.response && e.response.status);
                        logger.debug(e.response && e.response.data);
                        const timeLeftMs = endTimeMs - new Date().getTime();
                        if (timeLeftMs > 0) {
                          logger.info(`Create topic failed. Trying again after delay (${(timeLeftMs / 1000)} seconds\
                           left until timeout).`);
                          yield Promise.delay(delayMs);
                          continue; // eslint-disable-line
                        } else {
                          throw new errors.HttpStatusError(500,
                            'Timed out while trying to create a topic in Discourse');
                        }
                      }
                      throw e;
                    }
                  }
                })();
              }).catch((err) => {
                logger.debug('Some error', err);
                logger.debug(err.response && err.response.status);
                logger.debug(err.response && err.response.data);
                throw err;
              });
            }
            throw error;
          }).catch((error) => {
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
        });

        return pgTopic.save().then(() => {
          logger.info('topic saved in Postgres');
          return response.data;
        });
      })
      .then((topic) => {
        logger.info('returning topic');
        return discourseClient.getTopic(topic.topic_id, req.authUser.userId.toString())
        .then((fTopic) => {
          const fullTopic = fTopic;
          fullTopic.tag = params.tag;
          return adapter.adaptTopics(fullTopic).then((result) => {
            if ((result instanceof Array) && result.length === 1) {
              result = result[0]; // eslint-disable-line
            }
            return resp.status(200).send(util.wrapResponse(req.id, result));
          });
        });
      })
      .catch(error => next(error));
   };
