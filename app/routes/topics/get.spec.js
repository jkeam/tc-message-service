
/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, prepareDB, jwts, getDecodedToken } from '../../tests';


const db = require('../../models');
const request = require('supertest');
// const topicJson = require('../../tests/topic.json');
const server = require('../../app');

const axios = require('axios');
const sinon = require('sinon');
const config = require('config');

require('should-sinon');

function assertTopicAndPost(topicId, assertCallback, done) {
  // test topic
  return Promise.all([
    db.topics.findById(topicId),
    db.posts.findOne({ topicId }),
  ])
  .then((response) => {
    const topic = response[0];
    const topicPost = response[1];
    assertCallback(topic, topicPost);
    return done();
  })
  .catch(() => done());
}

describe('GET /v4/topics/:topicId', () => {
  const apiPathPrefix = `/${config.apiVersion}/topics/`;
  const apiPath = `${apiPathPrefix}1`;
  const nonExistingTopicPath = `${apiPathPrefix}1000`;

  const memberUser = {
    handle: getDecodedToken(jwts.member).handle,
    userId: getDecodedToken(jwts.member).userId,
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };

  let sandbox;
  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    prepareDB(done);
  });
  afterEach((done) => {
    sandbox.restore();
    clearDB(done);
  });

  it('should return 403 response without a jwt token', (done) => {
    request(server)
      .get(apiPath)
      .expect(403, done);
  });

  it('should return 403 response with invalid jwt token', (done) => {
    request(server)
      .get(apiPath)
      .set({
        Authorization: 'Bearer wrong',
      })
      .expect(403, done);
  });

  it('should return 404 response if no matching topic', (done) => {
    sandbox.stub(axios, 'get').resolves({ data: { result: {} } });
    request(server)
      .get(nonExistingTopicPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(404)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 403 response if user does not have access', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [] } } },
    });
    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(403)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 200 response when called by project member and should mark topic read', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // stub for updateUserStats method of PostUserStats modal
    const updateStatsStub = sandbox.stub(db.post_user_stats, 'updateUserStats').resolves();

    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });

    request(server)
      .get(`${apiPathPrefix}1`)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // once for reference endpoint call
        sinon.assert.calledOnce(getStub);
        // should call UPDATE on post user stats table
        updateStatsStub.should.have.be.calledOnce;
        // asserts the response with test data(created during test boostrap)
        return assertTopicAndPost(1, (topic, topicPost) => {
          res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topic.id);
          res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
          // console.log(topicPost.updatedAt, 'updatedAt');
          res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
          .eql(topicPost.updatedAt);
        }, done);
      });
  });

  it('should return 200 response when called by admin not on project team and not mark topic as read', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // stub for updateUserStats method of PostUserStats modal
    const updateStatsStub = sandbox.stub(db.post_user_stats, 'updateUserStats').resolves();

    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });

    request(server)
      .get(`${apiPathPrefix}1`)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // once for reference endpoint call
        sinon.assert.calledOnce(getStub);
        // should call UPDATE on post user stats table
        updateStatsStub.should.have.be.calledOnce;
        // asserts the response with test data(created during test boostrap)
        return assertTopicAndPost(1, (topic, topicPost) => {
          res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topic.id);
          res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
          // console.log(topicPost.updatedAt, 'updatedAt');
          res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
          .eql(topicPost.updatedAt);
        }, done);
      });
  });


  it('should return 500 response if error to get topic', (done) => {
    const findTopicStub = sandbox.stub(db.topics, 'findTopic').rejects();
    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(500)
      .end((err) => {
        if (err) {
          return done(err);
        }
        // should call findTopic on posts model
        findTopicStub.should.have.be.calledOnce;
        return done();
      });
  });
});
