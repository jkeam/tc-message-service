
const config = require('config');
const util = require('tc-core-library-js').util(config);
const Discourse = require('../../services/discourse');
const errors = require('common-errors');
const Joi = require('joi');
const multer = require('multer');

const upload = multer({ dest: './uploads/',
  limits: { fileSize: 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/image/.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new errors.HttpStatusError(400, 'Can only upload image file'));
  },
}).single('file');

/**
 * Upload image to Discourse
 * @return {object} response
 */
module.exports = () => (req, resp, next) => {
  const logger = req.log;
  const discourseClient = Discourse(logger);
  upload(req, resp, (err) => {
    if (err) {
      logger.error(err);
      next(err);
      return;
    }
    if (!req.file) {
      next(new errors.HttpStatusError(400, 'Missing file'));
      return;
    }
    // Validate request parameters
    Joi.assert(req.file, {
      originalname: Joi.string().required(),
      mimetype: Joi.string().required(),
      path: Joi.string().required(),
      filename: Joi.string().required(),
      destination: Joi.string().required(),
      encoding: Joi.string().required(),
      fieldname: Joi.string().required(),
      size: Joi.number().required(),
    });
    discourseClient.uploadImage(
      req.authUser.userId.toString(),
      req.file)
    .then((response) => {
      if (!response.data.url) {
        logger.error('Failed to upload image', response.data);
        throw new errors.HttpStatusError(500,
          response.data.errors ? response.data.errors.join(' ') : 'Failed to upload image');
      }
      // Prepend the discourse host
      response.data.url = `${config.get('discourseURL')}${response.data.url}`;
      logger.info('Image uploaded', response.data);
      return response.data;
    })
    .then(data => resp.status(200).send(util.wrapResponse(req.id, data)))
    .catch((error) => {
      logger.error(error);
      next(error instanceof errors.HttpStatusError ? error : new errors.HttpStatusError(
        error.response && error.response.status ? error.response.status : 500, 'Error uploading image'));
    });
  });
};
