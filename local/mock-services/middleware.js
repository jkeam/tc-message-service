/**
 * The middleware used to handle the requests which are not handled by json-server.
 */
const data = require('./services.json');

module.exports = (req, res, next) => {
  if (req.method === 'POST' && req.path === '/authorizations/') {
    const resp = {
      id: 1,
      result: {
        success: true,
        status: 200,
        metadata: null,
        content: {
          id: 477949215,
          modifiedBy: null,
          modifiedAt: null,
          createdBy: null,
          createdAt: null,
          token: 'token',
          refreshToken: null,
          target: 1,
          externalToken: null,
          zendeskJwt: null,
        },
      },
      version: 'v3',
    };
    res.json(resp);
  } else if (req.method === 'GET' && req.path === '/members/_search') {
    const userIds = {};
    req.query.query.split(' OR ').forEach((query) => {
      userIds[`${query.split(':')[1]}`] = true;
    });
    const found = [];
    data.users.forEach((user) => {
      if (userIds[`${user.id}`]) {
        found.push(user.result.content);
      }
    });
    res.json({
      id: 1,
      result: {
        success: true,
        status: 200,
        metadata: null,
        content: found,
      },
      version: 'v3',
    });
  } else {
    next();
  }
};
