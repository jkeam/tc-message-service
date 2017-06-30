/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { jwts } from '../../tests';

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
const postJson = require('../../tests/post.json');
require('should-sinon');

describe('POST /v4/topics/:topicId/posts/:postId/edit ', () => {
  const apiPath = '/v4/topics/1/posts/1/edit';
  const testBody = {
    post: 'test post',
  };
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });
  afterEach(() => {
    sandbox.restore();
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
    sandbox.stub(axios, 'put').resolves({ data: { post: postJson } });
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
              res.body.result.content.should.not.be.null;
              return done();
            });
  });

  it('should return 500 response with error response', (done) => {
    sandbox.stub(axios, 'put').rejects({
      response: {
        status: 500,
      },
    });
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
              res.body.should.have.propertyByPath('result', 'content', 'message')
                        .eql('Error updating post');
              return done();
            });
  });
});
