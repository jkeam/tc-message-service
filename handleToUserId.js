"use strict";

var _ = require('lodash');
var Promise  = require('bluebird');
var db = require('./app/models');
var axios = require('axios');
var Adapter = require('./app/services/adapter');
var config = require('config');
var coreLib = require('tc-core-library-js');

var logger = coreLib.logger({
  name: 'handle',
  level: _.get(config, "logLevel", 'debug').toLowerCase(),
  captureLogs: config.get('captureLogs'),
  logentriesToken: _.get(config, 'logentriesToken', null)
});

var adapter = new Adapter(logger, db)

var discourseClient = axios.create({
  baseURL: config.get('discourseURL')
});

discourseClient.defaults.params = {
  api_key: config.get('discourseApiKey'),
  api_username: config.get('discourseSystemUsername')
};

function renameUser(oldUser, newUser) {
  return discourseClient.put(`/users/${oldUser}/preferences/username`, {
    new_username: newUser
  }).catch((e) => null); // return null ao that promise chain wont break
}

var changed = {};

db.sequelize.query('ALTER TABLE topics RENAME "updatedBy" TO "updatedBy_old"')
  .then(() => db.sequelize.query('ALTER TABLE topics RENAME "createdBy" TO "createdBy_old"'))
  .then(() => db.sequelize.query('ALTER TABLE topics ADD COLUMN "updatedBy" character varying(255) NOT NULL DEFAULT \'foo\''))
  .then(() => db.sequelize.query('ALTER TABLE topics ADD COLUMN "createdBy" character varying(255) NOT NULL DEFAULT \'foo\''))
  .then(() => {
    return db.sequelize.query('SELECT * FROM topics')
      .then((result) =>
        Promise.map(result[0], (topic) => {
          var handles = _.filter([topic.createdBy_old, topic.updatedBy_old], (handle) => {
            if(!changed[handle]){
              changed[handle] = true;
              return true;
            }
            return false;
          });
          return Promise.map(handles, (handle) =>
            adapter.userIdLookup(handle)
              .then((userId) => {
                return {
                  userId,
                  handle
                }
              }))
            .then((results) =>
              Promise.map(results, (data) =>
                db.sequelize.query(`UPDATE topics SET "createdBy" = '${data.userId}' WHERE "createdBy_old" = '${data.handle}'`)
                  .then(() => db.sequelize.query(`UPDATE topics SET "updatedBy" = '${data.userId}' WHERE "updatedBy_old" = '${data.handle}'`))
                  .then(() => renameUser(data.userId, data.userId.toString()))
              ))
            .catch(e => console.log(e)
            )
        }))
      .then(() => {
        console.log('done')
      })
  })