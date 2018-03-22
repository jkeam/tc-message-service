/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { prepareDB, clearDB, jwts, getDecodedToken } from '../../tests';

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
const db = require('../../models');
const config = require('config');
require('should-sinon');

describe('DELETE /v4/topics/:topicId/posts/:postId ', () => {
  const topicId = 1;
  const postId = 1;
  const apiPath = `/${config.apiVersion}/topics/${topicId}/posts/${postId}`;
  const nonExistingTopicPath = `/${config.apiVersion}/topics/1000/posts/${postId}`;

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

  it('should return 403 response when user is not member of the project', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [] } } },
    });
    request(server)
      .delete(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(403, done);
  });

  it('should return 404 response if no matching topic', (done) => {
    request(server)
      .delete(nonExistingTopicPath)
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

  it('should return 200 response with valid jwt token and payload (admin access)', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [] } } },
    });
    request(server)
      .delete(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
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

  it('should return 500 response with error in fetching topic', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const findTopicStub = sandbox.stub(db.topics, 'findTopic').rejects();
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
        // should call findTopic on topics model
        findTopicStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error deleting post');
        return done();
      });
  });

  it('should return 500 response with error in fetching post', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const findPostStub = sandbox.stub(db.posts, 'findPost').rejects();
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
        // should call findPost on topics model
        findPostStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error deleting post');
        return done();
      });
  });
});
