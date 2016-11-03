'user strict'

/**
 * Middleware responsible for validating a token using the "system"  user
 * has a user id that matches the configured system user id
 */
var _ = require('lodash');
var config = require('config');

module.exports = (logger) => {
    var adminIds = {};

    _(config.get('systemUserIds').split(',')).each(id => {
        adminIds[id.trim()] = true;
    });

    return (req, resp, next) => {
        if(req.authUser && req.authUser.userId) {
            if(adminIds[req.authUser.userId]) {
                req.authUser.handle = 'system';
                next();
            } else if (req.authUser.handle.toLowerCase() === 'system') {
                resp.status(400).send({
                    message: 'Invalid User: User "system"  is reserved!'
                });
            } else {
                next();
            }
        } else {
            next();
        }
    }
}
