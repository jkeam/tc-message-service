
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

describe('GET /v4/topics/:topicId/posts/:postId', () => {
  const apiPath = `/${config.apiVersion}/topics/1/posts/1`;
  const nonExistingTopicPath = `/${config.apiVersion}/topics/1000/posts/1`;
  const nonExistingPostPath = `/${config.apiVersion}/topics/1/posts/1000`;
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

  it('should return 403 response when user is not member of the project', (done) => {
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
      .expect(403, done);
  });

  it('should return 404 response if no matching topic', (done) => {
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

  it('should return 404 response if no matching post', (done) => {
    request(server)
      .get(nonExistingPostPath)
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

  it('should return 200 response when valid post id is passed', (done) => {
    const getStub = sandbox.stub(axios, 'get');
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
      .end((err) => {
        if (err) {
          return done(err);
        }
        sinon.assert.calledOnce(getStub);
        return done();
      });
  });

  it('should return 200 response when valid post id is passed (admin access)', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [] } } },
    });

    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(200)
      .end((err) => {
        if (err) {
          return done(err);
        }
        sinon.assert.calledOnce(getStub);
        return done();
      });
  });


  it('should return 500 response if error to get post', (done) => {
    const findPostStub = sandbox.stub(db.posts_backup, 'findPost').rejects();
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
        // should call findPost on posts model
        findPostStub.should.have.be.calledOnce;
        return done();
      });
  });
});
