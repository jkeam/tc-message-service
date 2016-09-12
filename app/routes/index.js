'use strict'

/**
 * Loads and configures all sub routes of this api
 * logger: logger
 * db: sequelize db object containing all models
 */
module.exports = (logger, db) => {
    const router = require('express').Router();
    const config = require('config');
    const util = require('tc-core-library-js').util(config);

    // health check
    router.get('/_health', (req, res, next) => {
        // TODO more checks
        res.status(200).send({
            message: "All-is-well"
        });
    });

    // register discourse sso endpoint (no auth is needed)
    router.route('/sso').get(require('./sso/sso.js')(logger));
    
    // all project service endpoints need authentication
    const jwtAuth = require('tc-core-library-js').middleware.jwtAuthenticator
    router.all('/v4/topics*', jwtAuth(), (req, res, next) => {
        req.authToken = req.get('authorization').split(' ')[1];
        next();
    });

    // Register all the routes
    router.route('/v4/topics/:topicId')
        .get(require('./topics/get')(logger, db));

    router.route('/v4/topics')
        .post(require('./topics/create')(logger, db))
        .get(require('./topics/list')(logger, db));


    router.route('/v4/topics/:topicId/posts')
        .post(require('./topics/post.js')(logger, db));

    // register error handler
    router.use((err, req, res, next) => {
        logger.error(err);

        let httpStatus = err.status || 500;
        let message;
        
        // specific for validation errors
        if (err.isJoi && err.details && err.details.length > 0) {
            logger.debug(err.message);
            logger.debug(err.details);
            message = 'Validation error: ' + err.details.map(error => error.message).join(', ');
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
    //router.use((req, res, next) => {
        //const err = new Error('Not Found');
        ////err.status = 404;
        //next(err);
    //})

    return router;
};
