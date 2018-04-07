import { clearDB, prepareDB } from '../../tests';

const aws = require('aws-sdk');
const AWS = require('aws-sdk-mock');
const proxyquire = require('proxyquire');
const Promise = require('bluebird');
const axios = require('axios');
const config = require('config');
const request = require('supertest');
const sinon = require('sinon');
const should = require('should');
require('should-sinon');
const s3Mock = require('./webhook.s3.dynamodb.mock');

const topicJson = require('../../tests/discourseNewTopicWebhook.json');
const postJson = require('../../tests/discourseNewPostWebhook.json');
const existingTopicJson = require('../../tests/discourseReferenceLookup.json');

const topicHash = 'sha256=d02971ffe4f66f63024f3b55ac1c6d765e663b0fdf8496bdaec0e70c5563efee';
const postHash = 'sha256=52921b7fe74a31ea2c3805c9cddacb2e889a85182c636b6a56c8f86824989cdf';

describe('POST /v4/webhooks/topics/discourse', () => {
  const apiPath = `/${config.apiVersion}/webhooks/topics/discourse`;

  const server = require('../../app');
  let sandbox;

  let stubGetItem = sinon.stub();
  let stubPutItem = sinon.stub();
  let stubQuery = sinon.stub();
  let stubUpdateItem = sinon.stub();

  AWS.mock('DynamoDB', 'getItem', stubGetItem);
  AWS.mock('DynamoDB', 'putItem', stubPutItem);
  AWS.mock('DynamoDB', 'query', stubQuery);
  AWS.mock('DynamoDB', 'updateItem', stubUpdateItem);

  const resetDynamoStubs = () => {
    stubGetItem.reset();
    stubPutItem.reset();
    stubQuery.reset();
    stubUpdateItem.reset();
  };

  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    prepareDB(done);
  });
  afterEach((done) => {
    sandbox.restore();
    clearDB(done);

  });

  it('should return 403 response without a token header', (done) => {
    request(server)
      .post(apiPath)
      .expect(403, done);
  });

  it('should return 403 response with invalid token header', (done) => {
    request(server)
      .post(apiPath)
      .set({
        'x-discourse-event-signature': 'Token wrong',
        'x-discourse-event': 'topic_created',
      })
      .send(topicJson)
      .expect(403, done);
  });

  it('should return 403 response with invalid token header and no payload', (done) => {
    request(server)
      .post(apiPath)
      .set({
        'x-discourse-event-signature': 'Token wrong',
        'x-discourse-event': 'topic_created',
      })
      .expect(403, done);
  });

  it('should return 200 will ignore if do not care about webhook event', (done) => {
    request(server)
      .post(apiPath)
      .set({
        'x-discourse-event-signature': topicHash,
        'x-discourse-event': 'dont_care',
      })
      .send(topicJson)
      .expect(200, done)
  });

  it('should return 200 and process topic', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    getStub.withArgs(`${config.get('topicServiceUrl')}/15`).resolves(existingTopicJson);

    // see if exists
    stubGetItem.callsFake((params, cb) => {
      cb(null, null);
    });

    // create
    const mockedSavedTopic = {
      id: 1,
      user_id: 2,
      topic: 'hi!',
    };
    stubPutItem.callsFake((params, cb) => {
      cb(null, mockedSavedTopic);
    });

    // find all matching posts
    stubQuery.callsFake((params, cb) => {
      cb(null, null);
    });

    // update
    stubUpdateItem.callsFake((params, cb) => {
      cb(null, null);
    });

    request(server)
      .post(apiPath)
      .set({
        'x-discourse-event-signature': topicHash,
        'x-discourse-event': 'topic_created',
      })
      .send(topicJson)
      .expect(200)
      .end((err, res) => {
        resetDynamoStubs();
        done();
      });
  });

  it('should return 200 and process post', (done) => {
    stubGetItem.onFirstCall().callsFake((params, cb) => {
      // see if exists
      cb(null, null);
    }).onSecondCall().callsFake((params, cb) => {
      // find associated topic
      const existingTopic = {
        Item: {
          NewId: {
            S: '1'
          },
        },
      };
      cb(null, existingTopic);
    });

    // create
    stubPutItem.callsFake((params, cb) => {
      cb(null, {
        id: 1,
        user_id: 2,
        topicId: 1,
        cooked: 'hi',
        raw: 'hi',
      });
    });

    // update
    stubUpdateItem.callsFake((params, cb) => {
      cb(null, null);
    });

    request(server)
      .post(apiPath)
      .set({
        'x-discourse-event-signature': postHash,
        'x-discourse-event': 'topic_created',
      })
      .send(postJson)
      .expect(200)
      .end((err, res) => {
        resetDynamoStubs();
        done();
      });
  });

});
