
/* eslint-disable no-unused-expressions, newline-per-chained-call */

import _ from 'lodash';
import { clearDB, prepareDB, jwts, getDecodedToken } from '../../tests';

const db = require('../../models');
require('should-sinon');

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');


describe('POST /v4/topics ', () => {
  const apiPath = '/v4/topics';
  const testBody = {
    reference: 'project',
    referenceId: 'referenceId',
    tag: 'tag',
    title: 'title',
    body: 'body',
  };
  const testBody2 = {
    reference: 'notexist',
    referenceId: 'notexist',
    tag: 'tag',
    title: 'not exist',
    body: 'not exist',
  };
  const memberUser = {
    handle: getDecodedToken(jwts.member).handle,
    userId: getDecodedToken(jwts.member).userId,
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  // const adminUser = {
  //   handle: getDecodedToken(jwts.admin).handle,
  //   userId: getDecodedToken(jwts.admin).userId,
  //   firstName: 'fname',
  //   lastName: 'lName',
  //   email: 'some@abc.com',
  // };
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
      .expect(403, done);
  });

  it('should return 403 response with invalid jwt token', (done) => {
    request(server)
      .post(apiPath)
      .set({
        Authorization: 'Bearer wrong',
      })
      .expect(403, done);
  });

  it('should return 400 response without body', (done) => {
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(400)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  Object.keys(testBody).forEach((key) => {
    it(`should return 400 response without ${key} parameter`, (done) => {
      const body = _.cloneDeep(testBody);
      delete body[key];
      request(server)
        .post(apiPath)
        .set({
          Authorization: `Bearer ${jwts.admin}`,
        })
        .send(body)
        .expect(400)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          res.body.should.have.propertyByPath('result', 'content', 'message')
            .eql(`Validation error: "${key}" is required`);
          return done();
        });
    });
  });

  it('should return 403 response with invalid access', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(403)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 403 response if error to get referenceLookup endpoint (non admin)', (done) => {
    sandbox.stub(axios, 'get').rejects({});
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.manager}`,
      })
      .send(testBody)
      .expect(403)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 403 response if error to get referenceLookup endpoint (admin)', (done) => {
    sandbox.stub(axios, 'get').rejects({});
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(403)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 403 response with no matching referenceLookup', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody2)
      .expect(403)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 200 response with valid input', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const now = new Date();
    const userId = Number(memberUser.userId);
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
        // id field would be null for new topics for now because it is populated from discourse topic id
        // which no longer exists for new topics
        res.body.should.have.propertyByPath('result', 'content', 'id').null;
        // dbId is actually the primary key of the topic
        res.body.should.have.propertyByPath('result', 'content', 'dbId').eql(2);
        res.body.should.have.propertyByPath('result', 'content', 'reference').eql(testBody.reference);
        res.body.should.have.propertyByPath('result', 'content', 'referenceId').eql(testBody.referenceId);
        res.body.should.have.propertyByPath('result', 'content', 'tag').eql(testBody.tag);
        res.body.should.have.propertyByPath('result', 'content', 'title').eql(testBody.title);
        res.body.should.have.propertyByPath('result', 'content', 'postIds').length(1);
        // 3 should be the id of the new post, as we already have 2 posts as mock data
        res.body.should.have.propertyByPath('result', 'content', 'postIds', '0').eql(3);
        res.body.should.have.propertyByPath('result', 'content', 'date');
        new Date(res.body.result.content.date).should.be.above(now);
        res.body.should.have.propertyByPath('result', 'content', 'updatedDate');
        new Date(res.body.result.content.updatedDate).should.be.above(now);
        res.body.should.have.propertyByPath('result', 'content', 'userId').eql(userId);
        res.body.should.have.propertyByPath('result', 'content', 'posts').length(1);
        res.body.should.have.propertyByPath('result', 'content', 'posts', '0', 'rawContent').eql(testBody.body);
        res.body.should.have.propertyByPath('result', 'content', 'posts', '0', 'userId').eql(userId);
        res.body.should.have.propertyByPath('result', 'content', 'posts', '0', 'date');
        new Date(res.body.result.content.posts[0].date).should.be.above(now);
        res.body.should.have.propertyByPath('result', 'content', 'posts', '0', 'updatedDate');
        new Date(res.body.result.content.posts[0].updatedDate).should.be.above(now);
        // created topic should have valid lastActivityAt date
        res.body.should.have.propertyByPath('result', 'content', 'lastActivityAt');
        // lastActivityAt should be equal to the updatedDate of the last post, which 0th post for new topic
        new Date(res.body.result.content.lastActivityAt).should.be.eql(
          new Date(res.body.result.content.posts[0].updatedDate));
        return done();
      });
  });

  it('should return 500 response if error to createPrivatePost with reject', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const createTopicStub = sandbox.stub(db.topics_backup, 'createTopic').rejects();
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
        // should call findPost on posts model
        createTopicStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error creating topic');
        return done();
      });
  });
});
