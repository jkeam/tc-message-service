'user strict';

/**
 * Middleware responsible for validating a token using the "system"  user
 * has a user id that matches the configured system user id
 */
const _ = require('lodash');
const config = require('config');

module.exports = () => {
  const adminIds = {};

  _(config.get('systemUserIds').split(',')).each((id) => {
    adminIds[id.trim()] = true;
  });

  return (req1, resp, next) => {
    const req = req1;
    if (req.authUser && req.authUser.userId) {
      if (adminIds[req.authUser.userId]) {
        req.authUser.handle = config.get('discourseSystemUsername');
        next();
      } else if (req.authUser.handle.toLowerCase() === config.get('discourseSystemUsername')) {
        resp.status(400).send({
          message: `Invalid User: User "${config.get('discourseSystemUsername')}"  is reserved!`,
        });
      } else {
        next();
      }
    } else {
      next();
    }
  };
};
