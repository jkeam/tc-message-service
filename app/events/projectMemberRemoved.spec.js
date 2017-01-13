'use strict'
process.env.NODE_ENV = 'test';

require('should');
const _ = require('lodash');
const config = require('config');
const models = require('../models')
const axios = require('axios');
const sinon = require('sinon');
const sinonStubPromise = require('sinon-stub-promise');
const coreLib = require('tc-core-library-js');

sinonStubPromise(sinon);

const removeMemberHandler = require('./projectMemberRemoved');

const logger = coreLib.logger({
  name: 'tc-message-service-test',
  level: _.get(config, "logLevel", 'debug').toLowerCase(),
  captureLogs: config.get('captureLogs'),
  logentriesToken: _.get(config, 'logentriesToken', null)
});
const content = {
 "id": 1185,
 "userId": 40152856,
 "role": "manager",
 "isPrimary": true,
 "createdAt": "2016-11-04T03:57:57.000Z",
 "updatedAt": "2016-11-04T03:57:57.000Z",
 "createdBy": 40152856,
 "updatedBy": 40152856,
 "projectId": 521
};

const msg = {
  content: JSON.stringify(content),
 fields: {
   redelivered: false
 }
};

/**
 * Clear the db data
 */
function clearDBPromise() {
    return models.sequelize.sync()
        .then(() => models.topics.truncate({
            cascade: true,
            logging: false
        }))
        .then(() => models.referenceLookups.truncate({
            cascade: true,
            logging: false
        }));
}

/**
 * Clear the db data
 */
function clearDB(done) {
    clearDBPromise()
        .then(() => done())
}


/**
 * Prepare the db data
 */
function prepareDB(done) {
    clearDBPromise()
        .then(()=> models.topics.create({
            id:1,
            reference: 'project',
            referenceId: 521,
            discourseTopicId: 1,
            tag:'tag'
        }))
        .then(() => done())
}

describe('Event: project.member.removed', () => {
    var sandbox;
    beforeEach((done) => {
        sandbox = sinon.sandbox.create();
        prepareDB(done)
    });
    afterEach((done) => {
        sandbox.restore();
        clearDB(done);
    });
    it('should ack when user exist in project and removed', (done) => {
      sandbox.stub(axios, 'put').returnsPromise().resolves({});
      const channel = {
        ack: () => done(),
        nack: () => done('Nacked!!')
      }
      removeMemberHandler(logger, msg, channel);
    });

    it('should ack when user exist not exist in project', (done) => {
      sandbox.stub(axios, 'put').returnsPromise().rejects({});
      const channel = {
        ack: () => done(),
        nack: () => done('Nacked!!')
      }
      removeMemberHandler(logger, msg, channel);
    });

    it('should nack if error querying db ', (done) => {
      sandbox.stub(models.topics, 'findAll').returnsPromise().rejects({});
      const channel = {
        ack: () => done('Acked!!'),
        nack: () => done()
      }
      removeMemberHandler(logger, msg, channel);
    });
});
