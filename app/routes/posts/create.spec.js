/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, prepareDB, jwts, getDecodedToken } from '../../tests';

const db = require('../../models');
const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
// const postJson = require('../../tests/post.json');
require('should-sinon');

describe('POST /v4/topics/:topicId/posts ', () => {
  const apiPath = '/v4/topics/1/posts';
  const testBody = {
    post: 'test post',
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

  it('should return 200 response with valid jwt token and payload', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });

    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .send(testBody)
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
