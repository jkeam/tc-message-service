/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { jwts } from '../../tests';

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');

require('should-sinon');

describe('POST /v4/topics/image', () => {
  const apiPath = '/v4/topics/image';
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
            .attach('file', 'app/tests/test.png')
            .expect(403, done);
  });

  it('should return 403 response with invalid jwt token', (done) => {
    request(server)
            .post(apiPath)
            .set({
              Authorization: 'Bearer wrong',
            })
            .attach('file', 'app/tests/test.png')
            .expect(403, done);
  });

  it('should return 400 response when missing file', (done) => {
    sandbox.stub(axios, 'post').resolves({ data: { url: '/uploads/default/original/1.png' } });
    request(server)
            .post(apiPath)
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .expect(400)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              res.body.should.have.propertyByPath('result', 'content', 'message')
                        .eql('Missing file');
              return done();
            });
  });

  it('should return 400 response when uploading non-image file', (done) => {
    sandbox.stub(axios, 'post').resolves({ data: { url: '/uploads/default/original/1.png' } });
    request(server)
            .post(apiPath)
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .attach('file', 'app/tests/post.json')
            .expect(400)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              res.body.should.have.propertyByPath('result', 'content', 'message')
                        .eql('Can only upload image file');
              return done();
            });
  });

  it('should return 200 response with valid jwt token and payload', (done) => {
    sandbox.stub(axios, 'post').resolves({ data: { url: '/uploads/default/original/1.png' } });
    request(server)
            .post(apiPath)
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .attach('file', 'app/tests/test.png')
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              res.body.result.content.should.not.be.null;
              return done();
            });
  });

  it('should return 500 response when discourse returns error message', (done) => {
    const errMsg = 'some discourse error message';
    sandbox.stub(axios, 'post').resolves({ data: { errors: [errMsg] } });
    request(server)
            .post(apiPath)
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .attach('file', 'app/tests/test.png')
            .expect(500, done);
  });

  it('should return 500 response with error response', (done) => {
    sandbox.stub(axios, 'post').rejects({
      response: {
        status: 500,
      },
    });
    request(server)
            .post(apiPath)
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .attach('file', 'app/tests/test.png')
            .expect(500)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              res.body.should.have.propertyByPath('result', 'content', 'message')
                        .eql('Error uploading image');
              return done();
            });
  });
});
