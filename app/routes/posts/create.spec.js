/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, prepareDB, jwts, getDecodedToken } from '../../tests';

const db = require('../../models');
const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
const config = require('config');
// const postJson = require('../../tests/post.json');
require('should-sinon');

describe('POST /v4/topics/:topicId/posts ', () => {
  const topicId = 1;
  const apiPath = `/v4/topics/${topicId}/posts`;
  const nonExistingTopicPath = '/v4/topics/1000/posts';
  const testBody = {
    post: 'test post',
  };
  const testBodyWithHandle = {
    post: 'test post >@40152922<',
  };
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
      .post(apiPath)
      .send(testBody)
      .expect(403, done);
  });

  it('should return 403 response with invalid jwt token', (done) => {
    request(server)
      .post(apiPath)
      .set({
        Authorization: 'Bearer wrong',
      })
      .send(testBody)
      .expect(403, done);
  });

  it('should return 403 response when user is not member of the project', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [] } } },
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .send(testBody)
      .expect(403, done);
  });

  it('should return 404 response if no matching topic', (done) => {
    request(server)
      .post(nonExistingTopicPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(404)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 200 response with valid jwt token and payload', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    // resolves with user data for user mention lookup
    getStub.withArgs(`${config.get('memberServiceUrl')}/_search`).resolves({
      data: { result: { status: 200, content: [{ handle: 'testuser' }] } },
    });
    // resolves with user data for user mention lookup
    getStub.withArgs(`${config.memberServiceUrl}/testuser`).resolves({
      data: { result: { status: 200, content: { handle: 'testuser' } } },
    });
    const postStub = sandbox.stub(axios, 'post');
    postStub.withArgs(`${config.get('identityServiceEndpoint')}authorizations/`).resolves({
      data: { result: { status: 200, content: { token: 'mock' } } },
    });

    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .send(testBodyWithHandle)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.result.content.should.not.be.null;
        return done();
      });
  });

  it('should return 200 response with valid jwt token and payload (admin access)', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [] } } },
    });
    // resolves with user data for user mention lookup
    getStub.withArgs(`${config.get('memberServiceUrl')}/_search`).resolves({
      data: { result: { status: 200, content: [{ handle: 'testuser' }] } },
    });
    // resolves with user data for user mention lookup
    getStub.withArgs(`${config.memberServiceUrl}/testuser`).resolves({
      data: { result: { status: 200, content: { handle: 'testuser' } } },
    });
    const postStub = sandbox.stub(axios, 'post');
    postStub.withArgs(`${config.get('identityServiceEndpoint')}authorizations/`).resolves({
      data: { result: { status: 200, content: { token: 'mock' } } },
    });

    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBodyWithHandle)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.result.content.should.not.be.null;
        return done();
      });
  });

  it('should return 500 response with error response', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const createPostStub = sandbox.stub(db.posts_backup, 'createPost').rejects();
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(500)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call findPost on posts model
        createPostStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error creating post');
        return done();
      });
  });
});
