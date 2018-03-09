/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { prepareDB, clearDB, jwts, getDecodedToken } from '../../tests';

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
require('should-sinon');
const should = require('should');
const db = require('../../models');

describe('POST /v4/topics/:topicId/posts/:postId/edit ', () => {
  const topicId = 1;
  const postId = 1;
  const apiPath = `/v4/topics/${topicId}/posts/${postId}/edit`;
  let expectedTopicPosts = null;
  const testBody = {
    post: 'test post - updated',
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
    prepareDB()
    .then(({ posts }) => {
      expectedTopicPosts = posts;
      done();
    });
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
    const now = new Date();
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
        const expectedCreatedBy = Number(expectedTopicPosts[0].createdBy);
        res.body.result.content.should.not.be.null;
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(postId);
        // res.body.should.have.propertyByPath('result', 'content', 'topicId').eql(topicId);
        res.body.should.have.propertyByPath('result', 'content', 'rawContent').eql(testBody.post);
        res.body.should.have.propertyByPath('result', 'content', 'body').eql(testBody.post);
        // udpatedBy should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedBy);
        // updatedDate should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedDate);
        res.body.should.have.propertyByPath('result', 'content', 'userId').eql(expectedCreatedBy);
        res.body.should.have.propertyByPath('result', 'content', 'updatedDate');
        new Date(res.body.result.content.updatedDate).should.be.above(now);
        return done();
      });
  });

  it('should return 200 response with valid jwt token and payload (admin)', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const now = new Date();
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        const expectedCreatedBy = Number(expectedTopicPosts[0].createdBy);
        res.body.result.content.should.not.be.null;
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(postId);
        // res.body.should.have.propertyByPath('result', 'content', 'topicId').eql(topicId);
        res.body.should.have.propertyByPath('result', 'content', 'rawContent').eql(testBody.post);
        res.body.should.have.propertyByPath('result', 'content', 'body').eql(testBody.post);
        // udpatedBy should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedBy);
        // updatedDate should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedDate);
        res.body.should.have.propertyByPath('result', 'content', 'userId').eql(expectedCreatedBy);
        res.body.should.have.propertyByPath('result', 'content', 'updatedDate');
        new Date(res.body.result.content.updatedDate).should.be.above(now);
        return done();
      });
  });

  it('should return 200 response with valid jwt token and payload(manager)', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const now = new Date();
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.manager}`,
      })
      .send(testBody)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        const expectedCreatedBy = Number(expectedTopicPosts[0].createdBy);
        res.body.result.content.should.not.be.null;
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(postId);
        // res.body.should.have.propertyByPath('result', 'content', 'topicId').eql(topicId);
        res.body.should.have.propertyByPath('result', 'content', 'rawContent').eql(testBody.post);
        res.body.should.have.propertyByPath('result', 'content', 'body').eql(testBody.post);
        // udpatedBy should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedBy);
        // updatedDate should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedDate);
        res.body.should.have.propertyByPath('result', 'content', 'userId').eql(expectedCreatedBy);
        res.body.should.have.propertyByPath('result', 'content', 'updatedDate');
        new Date(res.body.result.content.updatedDate).should.be.above(now);
        return done();
      });
  });

  it('should return 500 response with error in finding the topic of the post to be updated', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const findByIdStub = sandbox.stub(db.topics_backup, 'findById').rejects();
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .send(testBody)
      .expect(500)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call findById on posts model
        findByIdStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error updating post');
        return done();
      });
  });

  it('should return 500 response with error in finding the post to be updated', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const findByIdStub = sandbox.stub(db.posts_backup, 'findById').rejects();
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
        // should call findById on posts model
        findByIdStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error updating post');
        return done();
      });
  });
});
