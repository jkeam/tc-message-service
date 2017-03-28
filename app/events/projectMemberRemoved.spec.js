
require('should');
const _ = require('lodash');
const config = require('config');
const models = require('../models');
const axios = require('axios');
const sinon = require('sinon');
const coreLib = require('tc-core-library-js');

const removeMemberHandler = require('./projectMemberRemoved');

const logger = coreLib.logger({
  name: 'tc-message-service-test',
  level: _.get(config, 'logLevel', 'debug').toLowerCase(),
  captureLogs: config.get('captureLogs'),
  logentriesToken: _.get(config, 'logentriesToken', null),
});
const content = {
  id: 1185,
  userId: 40152856,
  role: 'manager',
  isPrimary: true,
  createdAt: '2016-11-04T03:57:57.000Z',
  updatedAt: '2016-11-04T03:57:57.000Z',
  createdBy: 40152856,
  updatedBy: 40152856,
  projectId: 521,
};

const msg = {
  content: JSON.stringify(content),
  fields: {
    redelivered: false,
  },
};

/**
 * Clear the db data
 * @return {void}
 */
function clearDBPromise() {
  return models.sequelize.sync()
        .then(() => models.topics.truncate({
          cascade: true,
          logging: false,
        }))
        .then(() => models.referenceLookups.truncate({
          cascade: true,
          logging: false,
        }));
}

/**
 * Clear the db data
 * @param {function} done callback
 * @return {void}
 */
function clearDB(done) {
  clearDBPromise()
        .then(() => done());
}


/**
 * Prepares the db
 * @param  {Function} done callback
 * @return {void}
 */
function prepareDB(done) {
  clearDBPromise()
        .then(() => models.topics.create({
          id: 1,
          reference: 'project',
          referenceId: 521,
          discourseTopicId: 1,
          tag: 'tag',
        }))
        .then(() => done());
}

describe('Event: project.member.removed', () => {
  let sandbox;
  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    prepareDB(done);
  });
  afterEach((done) => {
    sandbox.restore();
    clearDB(done);
  });

  const invoked = (done) => { true.should.be.true; done(); } // eslint-disable-line
  const errorCheck = (done) => { true.should.be.false; done(); } // eslint-disable-line
  it('should ack when user exist in project and removed', (done) => {
    sandbox.stub(axios, 'put').resolves({});
    const channel = {
      ack: () => invoked(done),
      nack: () => errorCheck(done),
    };
    removeMemberHandler(logger, msg, channel);
  });

  it('should nack when if discourse call fails', (done) => {
    sandbox.stub(axios, 'put').rejects({});
    const channel = {
      ack: () => errorCheck(done),
      nack: () => invoked(done),
    };
    removeMemberHandler(logger, msg, channel);
  });

  it('should nack if error querying db ', (done) => {
    sandbox.stub(models.topics, 'findAll').rejects({});
    const channel = {
      ack: () => errorCheck(done),
      nack: () => invoked(done),
    };
    removeMemberHandler(logger, msg, channel);
  });
});
