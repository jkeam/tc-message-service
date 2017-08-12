
/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, prepareDB, jwts } from '../../tests';


const request = require('supertest');
const postJson = require('../../tests/post.json');
const server = require('../../app');

const axios = require('axios');
const sinon = require('sinon');

require('should-sinon');

describe('GET /v4/topics/:topicId/posts', () => {
  const apiPath = '/v4/topics/1/posts?postIds=1,2';

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
            .get('/v4/topics/1/posts')
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .expect(400,done);
  });

  it('should return 404 response if no matching topic', (done) => {
    sandbox.stub(axios, 'get').rejects({ response: { status: 404 } });
    request(server)
            .get(apiPath)
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .expect(404, done);
  });

  it('should return 200 response if no matching posts', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves({ data: { post_stream: { posts: [] } } });
    request(server)
            .get(apiPath)
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .expect(200)
            .end((err) => {
              console.log('baaaa');
              if (err) {
                return done(err);
              }
              sinon.assert.calledOnce(getStub);
              return done();
            });
  });

  it('should return 200 response when posts are retrieved', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves({ data: { post_stream: { posts: [postJson] } } });

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


  it('should return 500 response if error to get posts', (done) => {
    sandbox.stub(axios, 'get').rejects({ response: { status: 500 } });
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
              return done();
            });
  });
});
