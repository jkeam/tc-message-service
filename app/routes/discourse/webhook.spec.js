import { clearDB, prepareDB } from '../../tests';

const db = require('../../models');
const request = require('supertest');
// const postJson = require('../../tests/post.json');
const server = require('../../app');

const axios = require('axios');
const config = require('config');

const sinon = require('sinon');
const should = require('should');
require('should-sinon');

const topicJson = require('../../tests/discourseNewTopicWebhook.json');
const postJson = require('../../tests/discourseNewPostWebhook.json');
const existingTopicJson = require('../../tests/discourseReferenceLookup.json');

const topicHash = 'sha256=d02971ffe4f66f63024f3b55ac1c6d765e663b0fdf8496bdaec0e70c5563efee';
const postHash = 'sha256=52921b7fe74a31ea2c3805c9cddacb2e889a85182c636b6a56c8f86824989cdf';

describe('POST /v4/webhooks/topics/discourse', () => {
  const apiPath = `/${config.apiVersion}/webhooks/topics/discourse`;

  let sandbox;
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

  it('should return 200 if validate topic payload and will ignore if do not care about webhook', (done) => {
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
    request(server)
      .post(apiPath)
      .set({
        'x-discourse-event-signature': topicHash,
        'x-discourse-event': 'topic_created',
      })
      .send(topicJson)
      .expect(200, done)
  });

  it('should return 200 and process topic', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    getStub.withArgs(`${config.get('topicServiceUrl')}/15`).resolves(existingTopicJson);

    request(server)
      .post(apiPath)
      .set({
        'x-discourse-event-signature': topicHash,
        'x-discourse-event': 'topic_created',
      })
      .send(topicJson)
      .expect(200)
      .end((err, res) => {
        getStub.should.have.be.calledOnce;
        done();
      });
  });

  it('should return 200 and process post', (done) => {
    request(server)
      .post(apiPath)
      .set({
        'x-discourse-event-signature': postHash,
        'x-discourse-event': 'topic_created',
      })
      .send(postJson)
      .expect(200, done)
  });


  // .then(response => {
      //     should(response.body.token).be.exactly('foo@bar.com')
      // })

});
