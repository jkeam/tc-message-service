'user strict'

/**
 * Middleware responsible for validating a token using the "system"  user
 * has a user id that matches the configured system user id
 */
var _ = require('lodash');
var config = require('config')

module.exports = (logger) => {
    var adminIds = {};

    _(config.get('systemUserIds').split(',')).each(id => {
        adminIds[id.trim()] = true;
    });

    return (req, resp, next) => {
        if(req.authUser && req.authUser.userId) {
            if(adminIds[req.authUser.userId]) {
                req.authUser.handle = config.get('discourseSystemUsername');
                next();
            } else if (req.authUser.handle.toLowerCase() === config.get('discourseSystemUsername')) {
                resp.status(400).send({
                    message: `Invalid User: User "${config.get('discourseSystemUsername')}"  is reserved!`
                });
            } else {
                next();
            }
        } else {
            next();
        }
    }
}
