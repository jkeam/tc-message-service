
const aws = require('aws-sdk');
const config = require('config');
const errors = require('common-errors');
const HelperService = require('../../services/helper');
const Joi = require('joi');
const { REFERENCE_LOOKUPS } = require('../../constants');

const s3 = new aws.S3(config.get('aws.config'));
const HttpStatusError = errors.HttpStatusError;

/**
 * Get specific attachment
 * @param {Object} db sequelize db with all models loaded
 * @return {Object} response
 */
module.exports = db =>
  /**
   * Redirects to the specified attachment for the specified post, and in the process it does:
   *  - Checks if the user has access to the project
   *  - Makes sure the attachment is available (present and not soft deleted)
   */
  (req, resp, next) => {
    const logger = req.log;
    const helper = HelperService(logger, db);

    // Validate request parameters
    Joi.assert(req.authUser, Joi.object().keys({
      handle: Joi.string().required(),
    }).unknown());
    const params = Joi.attempt(req.params, Joi.object().keys({
      postId: Joi.number().required(),
    }).unknown());
    const query = Joi.attempt(req.query, {
      referenceId: Joi.number().required(),
    });
    const userId = req.authUser.userId.toString();

    return helper.callReferenceEndpoint(req.authToken, req.id, REFERENCE_LOOKUPS.PROJECT, query.referenceId)
      .then((hasAccessResp) => {
        const hasAccess = helper.userHasAccessToEntity(userId, hasAccessResp, REFERENCE_LOOKUPS.PROJECT);
        if (!hasAccess && !helper.isAdmin(req)) {
          throw new errors.HttpStatusError(403, 'User doesn\'t have access to the project');
        }

        return db.postAttachments.findOne({ where: { id: params.attachmentId, postId: params.postId } });
      })
      .then((postAttachment) => {
        if (!postAttachment || postAttachment.deletedAt) {
          throw new errors.HttpStatusError(404, 'Could not find the requested attachment');
        }
        const signedUrl = s3.getSignedUrl('getObject', {
          Bucket: config.get('aws.S3.bucket'),
          Key: helper.s3KeyFromUrl(postAttachment.url),
        });
        resp.redirect(signedUrl);
      })
      .catch((error) => {
        logger.error(error);
        next(error instanceof HttpStatusError ? error : new HttpStatusError(500, 'Error getting attachment'));
      });
  };
