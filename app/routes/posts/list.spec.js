
/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, prepareDB, jwts, getDecodedToken } from '../../tests';

const db = require('../../models');

const request = require('supertest');
// const postJson = require('../../tests/post.json');
const server = require('../../app');

const axios = require('axios');
const sinon = require('sinon');
const config = require('config');

require('should-sinon');

describe('GET /v4/topics/:topicId/posts', () => {
  const apiPath = `/${config.apiVersion}/topics/1/posts?postIds=1,2`;
  const missingPostsIdsPath = `/${config.apiVersion}/topics/1/posts`;
  const noMatchingPostsPath = `/${config.apiVersion}/topics/1/posts?postIds=3,4`;
  const nonExistingPostsPath = `/${config.apiVersion}/topics/1/posts?postIds=1,2,3`;
  const nonExistingTopicApiPath = `/${config.apiVersion}/topics/1000/posts?postIds=1,2`;

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

  it('should return 400 response if missing postIds parameter', (done) => {
    request(server)
      .get(missingPostsIdsPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(400, done);
  });

  it('should return 404 response if no matching topic', (done) => {
    request(server)
      .get(nonExistingTopicApiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(404, done);
  });

  it('should return 403 response when user does not have access to the project (403 in reference lookup)', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();

    // rejects to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 403 } },
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
        // once for reference endpoint call
        sinon.assert.calledOnce(getStub);
        return done();
      });
  });

  it('should return 403 response when user does not have access to the project (not project member)', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();

    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    // but members does not have calling user's id
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: 123 }] } } },
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
        // once for reference endpoint call
        sinon.assert.calledOnce(getStub);
        return done();
      });
  });

  it('should return 200 response if no matching posts', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();

    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    request(server)
      .get(noMatchingPostsPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        sinon.assert.calledOnce(getStub);
        res.body.result.content.should.be.of.length(0);
        return done();
      });
  });

  it('should return 200 response if postIds has non existing post ids along with valid ones', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();

    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });

    request(server)
      .get(nonExistingPostsPath)// nonExistingPostsPath has one extra id which does not exists
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
        // it should still return the two valid posts
        res.body.result.content.should.be.of.length(2);
        return done();
      });
  });

  it('should return 200 response when postIds are valid', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();

    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });

    request(server)
      .get(apiPath)
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
        res.body.result.content.should.be.of.length(2);
        return done();
      });
  });

  it('should return 200 response when postIds are valid (manager access)', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();

    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });

    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.manager}`,
      })
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // once for reference endpoint call
        sinon.assert.calledOnce(getStub);
        res.body.result.content.should.be.of.length(2);
        return done();
      });
  });

  it('should return 200 response when postIds are valid (admin access)', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();

    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });

    request(server)
      .get(apiPath)
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
        res.body.result.content.should.be.of.length(2);
        return done();
      });
  });

  it('should return 500 response if error to get posts', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    // stub for updateUserStats method of PostUserStats modal
    const findPostsStub = sandbox.stub(db.posts, 'findPosts').rejects();
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
        // should call findPosts on posts model
        findPostsStub.should.have.be.calledOnce;
        return done();
      });
  });
});
