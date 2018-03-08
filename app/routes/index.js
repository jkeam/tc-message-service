
const router = require('express').Router();
const config = require('config');
const util = require('tc-core-library-js').util(config);
const tcCoreLib = require('tc-core-library-js');
const getTopicHandler = require('./topics/get');
const topicListHandler = require('./topics/list');
const topicCreateHandler = require('./topics/create');
const topicUpdateHandler = require('./topics/update');
const topicDeleteHandler = require('./topics/delete');

// const uploadImageHandler = require('./image/upload');
const createPostHandler = require('./posts/create');
const listPostsHandler = require('./posts/list');
const getPostHandler = require('./posts/get');
const updatePostHandler = require('./posts/update');
const deletePostHandler = require('./posts/delete');
const systemUserFilter = require('../middleware/system-user-filter.js');

const jwt = require('jsonwebtoken');

/**
 * Loads and configures all sub routes of this api
 * @param {Object} logger: logger
 * @param {Object} db sequelize db object containing all models
 * @return {Object} response
 */
module.exports = (logger, db) => {
  // health check
  router.get('/_health', (req, res, next) => { // eslint-disable-line
    // TODO check if database connection is alive
    res.status(200).send({ message: 'All-is-well' });
  });

  // register discourse sso endpoint (no auth is needed)
  // router.route('/sso').get(ssoHandler(logger));

  // all project service endpoints need authentication
  const jwtAuth = tcCoreLib.middleware.jwtAuthenticator;
  router.all('/v4/topics*', (req, res, next) => {
    if (`${process.env.TC_MESSAGE_SERVICE_AUTH_LOOSE}` !== 'true') {
      jwtAuth()(req, res, next);
      return;
    }
    try {
      const decoded = jwt.decode(req.headers.authorization.split(' ')[1]);
      const issuer = `https://api.${config.get('authDomain')}`;
      if (!decoded) {
        res.status(403)
          .json(util.wrapErrorResponse(req.id, 403, 'No token provided.'));
        res.send();
      } else if (decoded.iss !== issuer) {
        // verify issuer
        res.status(403)
          .json(util.wrapErrorResponse(req.id, 403, 'Invalid token issuer.'));
        res.send();
      } else {
        // if everything is good, save to request for use in other routes
        req.authUser = decoded;
        req.authUser.userId = parseInt(req.authUser.userId, 10);
        next();
      }
    } catch (err) {
      logger.error(err);
      res.status(403)
        .json(util.wrapErrorResponse(req.id, 403, 'Failed to authenticate token.'));
      res.send();
    }
  }, (req, res, next) => {
    req.authToken = req.get('authorization').split(' ')[1]; // eslint-disable-line
    next();
  });

  router.use(systemUserFilter(logger));

  // Register all the routes
  router.route('/v4/topics/:topicId')
    .get(getTopicHandler(db))
    .delete(topicDeleteHandler(db));
  router.route('/v4/topics/:topicId/edit')
    .post(topicUpdateHandler(db));

  router.route('/v4/topics')
    .post(topicCreateHandler(db))
    .get(topicListHandler(db));


  router.route('/v4/topics/:topicId/posts')
    .post(createPostHandler(db))
    .get(listPostsHandler(db));

  router.route('/v4/topics/:topicId/posts/:postId')
    .delete(deletePostHandler(db))
    .get(getPostHandler(db));

  router.route('/v4/topics/:topicId/posts/:postId/edit')
    .post(updatePostHandler(db));

  // router.route('/v4/topics/image')
  //   .post(uploadImageHandler());

  // register error handler
  router.use((err, req, res, next) => { // eslint-disable-line
    req.log.error(err);

    let httpStatus = err.status || 500;
    let message;

    // specific for validation errors
    if (err.isJoi && err.details && err.details.length > 0) {
      req.log.debug(err.message);
      req.log.debug(err.details);
      message = `Validation error: ${err.details.map(error => error.message).join(', ')}`;
      httpStatus = 400;
    } else {
      message = err.message;
    }

    const body = util.wrapErrorResponse(req.id, httpStatus, message);

    // add stack trace if development environment
    if (process.env.ENVIRONMENT in ['development', 'test', 'qa']) {
      body.result.debug = err.stack;
    }

    res.status(httpStatus).send(body);
  });

  // catch 404 and forward to error handler
  // router.use((req, res, next) => {
  // const err = new Error('Not Found');
  // //err.status = 404;
  // next(err);
  // })

  return router;
};
