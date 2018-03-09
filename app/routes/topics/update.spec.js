/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, prepareDB, jwts, getDecodedToken } from '../../tests';

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');

require('should-sinon');
const should = require('should');
const db = require('../../models');

describe('POST /v4/topics/:topicId/edit ', () => {
  const topicId = 1;
  const postId = 1;
  const apiPath = `/v4/topics/${topicId}/edit`;
  const nonExistingTopicPath = '/v4/topics/1000/edit';
  let expectedTopic = null;
  let expectedTopicPosts = null;
  const testBody = {
    postId,
    title: 'title-updated',
    content: 'content-updated',
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
    .then(({ topic, posts }) => {
      expectedTopic = topic;
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

  it('should return 403 response when user does not have access', (done) => {
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
      .expect(403)
      .end((err) => {
        if (err) {
          return done(err);
        }
        // should make GET to reference lookup endpoint on posts model
        getStub.should.have.be.calledOnce;
        return done();
      });
  });

  it('should return 404 response with non existing topic', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    request(server)
      .post(nonExistingTopicPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .send(testBody)
      .expect(404)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call findById on posts model
        res.body.should.have.propertyByPath('result', 'content', 'message')
                  .eql('Topic does not exist');
        return done();
      });
  });

  it('should return 200 response with valid jwt token and payload', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const now = new Date();
    // const userId = Number(memberUser.userId);
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
        const expectedCreatedBy = Number(expectedTopic.createdBy);
        res.body.result.content.should.not.be.null;
        res.body.result.content.topic.should.not.be.null;
        res.body.result.content.post.should.not.be.null;
        console.log(res.body.result.content);
        // id of the updated topic should be same as of id passed in API path
        res.body.should.have.propertyByPath('result', 'content', 'topic', 'id').eql(topicId);
        res.body.should.have.propertyByPath('result', 'content', 'topic', 'title').eql(testBody.title);
        // createdBy should not change
        res.body.should.have.propertyByPath('result', 'content', 'topic', 'userId').eql(expectedCreatedBy);
        // udpatedBy should be null originally for the test data
        should.not.exist(expectedTopic.updatedBy);
        // updatedDate should be null originally for the test data
        should.not.exist(expectedTopic.updatedDate);
        res.body.should.have.propertyByPath('result', 'content', 'topic', 'updatedDate');
        new Date(res.body.result.content.topic.updatedDate).should.be.above(now);
        res.body.should.have.propertyByPath('result', 'content', 'post', 'id').eql(postId);
        res.body.should.have.propertyByPath('result', 'content', 'post', 'rawContent').eql(testBody.content);
        // udpatedBy should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedBy);
        // updatedDate should be null originally for the test data
        should.not.exist(expectedTopicPosts[0].updatedDate);
        res.body.should.have.propertyByPath('result', 'content', 'post', 'userId').eql(expectedCreatedBy);
        res.body.should.have.propertyByPath('result', 'content', 'post', 'updatedDate');
        new Date(res.body.result.content.post.updatedDate).should.be.above(now);
        return done();
      });
  });

  it('should return 500 response if error updating post', (done) => {
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
        // should call findById on topics model
        findByIdStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
                  .eql('Error updating topic');
        return done();
      });
  });

  it('should return 500 response with error finding post', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const findByIdStub = sandbox.stub(db.posts_backup, 'findById').rejects();
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
                  .eql('Error updating topic');
        return done();
      });
  });
});
