

const app = require('./app');
const expressListRoutes = require('express-list-routes');

// =======================
// start the server ======
// =======================
const port = process.env.PORT || 3000; // used to create, sign, and verify tokens

const server = app.listen(port, () => {
  app.logger.info('Starting server on PORT: %d', port);
  expressListRoutes({ prefix: '', spacer: 7 }, 'APIs:', app.routerRef);
});

module.exports = server;
