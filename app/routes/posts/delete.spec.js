/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { prepareDB, clearDB, jwts, getDecodedToken } from '../../tests';

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
const db = require('../../models');
require('should-sinon');

describe('DELETE /v4/topics/:topicId/posts/:postId ', () => {
  const topicId = 1;
  const postId = 1;
  const apiPath = `/v4/topics/${topicId}/posts/${postId}`;

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
    prepareDB()
    .then(() => {
      // expectedTopic = topic;
      // expectedTopicPosts = posts;
      // console.log(expectedTopic, expectedTopicPosts);
      done();
    });
  });
  afterEach((done) => {
    sandbox.restore();
    clearDB(done);
  });
  it('should return 403 response without a jwt token', (done) => {
    request(server)
      .delete(apiPath)
      .expect(403, done);
  });

  it('should return 403 response with invalid jwt token', (done) => {
    request(server)
      .delete(apiPath)
      .set({
        Authorization: 'Bearer wrong',
      })
      .expect(403, done);
  });

  it('should return 200 response with valid jwt token and payload', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    request(server)
      .delete(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.result.success.should.eql(true);
        return done();
      });
  });

  it('should return 500 response with error response', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const findByIdStub = sandbox.stub(db.topics_backup, 'findById').rejects();
    request(server)
      .delete(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(500)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call findById on topics model
        findByIdStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error deleting post');
        return done();
      });
  });
});
