import errors from 'common-errors';
import config from 'config';
import Adapter from '../../services/adapter';
import HelperService from '../../services/helper';
// import _  from require('lodash');

const util = require('tc-core-library-js').util(config);


/**
 * Get specific topic
 * @param {Object} db sequelize db with all models loaded
 * @return {Object} response
 */
module.exports = db =>

  /**
   * Gets topic from database for the specified entity, and in the process it does:
   *  - Checks if topic exists in the database, throws error if not
   *  - Checks if the user has access to the referred entity, throws error if not
   * params: standard express parameters
   */
  (req, resp, next) => {
    const logger = req.log;
    const helper = HelperService(logger, db);
    const adapter = new Adapter(logger, db);
    const topicId = req.params.topicId;
    const userId = req.authUser.userId.toString();

    // Get topic from the Postgres database
    return db.topics_backup.findTopic(db, adapter, { topicId, numberOfPosts: -1, reqUserId: userId })
    .then((dbTopic) => {
      if (!dbTopic) {
        const err = new errors.HttpStatusError(404, 'Topic does not exist');
        return next(err);
      }

      return helper.callReferenceEndpoint(req.authToken, req.id, dbTopic.reference, dbTopic.referenceId)
      .then((hasAccessResp) => {
        const hasAccess = helper.userHasAccessToEntity(userId, hasAccessResp, dbTopic.reference);
        if (!hasAccess && !helper.isAdmin(req)) {
          throw new errors.HttpStatusError(403, 'User doesn\'t have access to the entity');
        }

        logger.debug('returning topic');
        return dbTopic;
      })
      .then(result => resp.status(200).send(util.wrapResponse(req.id, result)));
    })
    .catch((error) => {
      next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(500, 'Error fetching topics'));
    });
  };
