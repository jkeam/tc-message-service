
const aws = require('aws-sdk');
const config = require('config');
const digestStream = require('digest-stream');
const util = require('tc-core-library-js').util(config);
const HelperService = require('../../services/helper');
const errors = require('common-errors');
const Joi = require('joi');
const Promise = require('bluebird');
const multer = require('multer');
const multerS3 = require('multer-s3');
const { REFERENCE_LOOKUPS } = require('../../constants');

const upload = Promise.promisify(multer({
  storage: multerS3({
    s3: new aws.S3(config.get('aws.config')),
    bucket: config.get('aws.S3.bucket'),
    contentType: (req, file, cb) => {
      // we use this function to provide a replacement stream, which is the original stream piped to a
      // stream that calculates the sha checksum on the fly (with a low memory footprint) and can be used as a source
      // stream to feed data to a Writable
      const stream = digestStream('sha1', 'hex', (checksum) => {
        // eslint-disable-next-line no-param-reassign
        file.sha1 = checksum;
      });
      file.stream.pipe(stream);
      cb(null, file.mimetype, stream);
    },
    key: (req, file, cb) => cb(null, `${req.params.postId}/${Date.now()}-${file.originalname}`),
  }),
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image/.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new errors.HttpStatusError(400, 'Can only upload image file'));
  },
}).single('file'));

/**
 * Handles creation of attachments
 * @param {Object} db sequelize db with all models loaded
 * @return {Object} response object
 */
module.exports = db =>
  /**
   * Upload image to Discourse
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

    return helper.userHasAccessToEntity(req.authToken, req.id, REFERENCE_LOOKUPS.PROJECT, query.referenceId)
      .then((hasAccessResp) => {
        logger.info('Checking if user has access to identity');
        const hasAccess = hasAccessResp[0];
        if (!hasAccess) { throw new errors.HttpStatusError(403, 'User doesn\'t have access to the project'); }
        return upload(req, resp);
      })
      .then(() => {
        if (!req.file) {
          throw new errors.HttpStatusError(400, 'Missing file');
        }
        // Validate parameters
        Joi.assert(req.file, Joi.object().keys({
          location: Joi.string().required(),
          originalname: Joi.string().required(),
          sha1: Joi.string().required(),
          size: Joi.number().required(),
        }).unknown());
        return db.postAttachments.create({
          postId: params.postId,
          originalFileName: req.file.originalname,
          fileSize: req.file.size,
          sha1: req.file.sha1,
          url: req.file.location,
          createdBy: req.authUser.handle,
          // follow sequelize on how it fills updatedAt on creation
          updatedBy: req.authUser.handle,
        });
      })
      .then((createdPostAttachment) => {
        const content = createdPostAttachment.toJSON();
        logger.info('Attachment uploaded', content);
        // remove excluded attributes from the response
        ['deletedAt', 'deletedBy', 'url'].forEach(attribute => delete content[attribute]);
        resp.status(200).send(util.wrapResponse(req.id, content));
      })
      .catch((error) => {
        logger.error(error);
        next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(
          error.response && error.response.status ? error.response.status : 500, 'Error uploading attachment'));
      });
  };
