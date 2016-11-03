'use strict'

// Dependencies
var express = require('express');
var Routes = require('./app/routes');
var coreLib = require('tc-core-library-js');
var config = require('config');
var sequelize = require('sequelize');
var _ = require('lodash');
var db = require('./app/models');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var expressRequestId = require('express-request-id')

// init logger
var appName = 'tc-message-service'
if(process.env.ENVIRONMENT) {
    switch (process.env.ENVIRONMENT.toLowerCase()) {
    case 'development':
        appName += "-dev"
        break
    case 'qa':
        appName += "-qa"
        break
    case 'production':
    default:
        appName += '-prod'
        break
    }
}

var logger = coreLib.logger({
  name: appName,
  level: _.get(config, "logLevel", 'debug').toLowerCase(),
  captureLogs: config.get('captureLogs'),
  logentriesToken: _.get(config, 'logentriesToken', null)
});

var routes = Routes(logger, db);

// Environment configs
var port = process.env.PORT || 3000;

// Define and configure app
var app = express();

// add request Id
var addRequestId = expressRequestId()
app.use(addRequestId)

app.use(coreLib.middleware.logger(null, logger));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(routes);

// Define the server
var server = app.listen(port, () => {});

module.exports = server;
