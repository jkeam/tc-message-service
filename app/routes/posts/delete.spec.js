/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { jwts } from '../../tests';

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
require('should-sinon');

describe('DELETE /v4/topics/:topicId/posts/:postId ', () => {
  const apiPath = '/v4/topics/1/posts/1';
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.sandbox.create();
  });
  afterEach(() => {
    sandbox.restore();
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
    sandbox.stub(axios, 'delete').resolves({});
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

  it('should return 500 response with error response', (done) => {
    sandbox.stub(axios, 'delete').rejects({
      response: {
        status: 500,
      },
    });
    request(server)
            .delete(apiPath)
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .expect(500)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              res.body.should.have.propertyByPath('result', 'content', 'message')
                        .eql('Error deleting post');
              return done();
            });
  });
});
