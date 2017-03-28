/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, prepareDB, jwts } from '../../tests';

require('should-sinon');

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');

const topicJson = require('../../tests/topic.json');

describe('GET /v4/topics ', () => {
  const apiPath = '/v4/topics';
  const testQuery = {
    filter: 'tag=tag&reference=reference&referenceId=referenceId',
  };
  const testQuery2 = {
    filter: 'tag=notexist&reference=notexist&referenceId=notexist',
  };
  // const testQuery3 = {
  //   filter: 'tag=tag&reference=notexist&referenceId=referenceId',
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

  it('should return 400 response without filter', (done) => {
    request(server)
            .get(apiPath)
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

  it('should return 400 response without reference filter', (done) => {
    request(server)
            .get(apiPath)
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .query({
              filter: 'referenceId=1',
            })
            .expect(400)
            .end((err) => {
              if (err) {
                return done(err);
              }
              return done();
            });
  });

  it('should return 400 response without referenceId filter', (done) => {
    request(server)
            .get(apiPath)
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .query({
              filter: 'reference=1',
            })
            .expect(400)
            .end((err) => {
              if (err) {
                return done(err);
              }
              return done();
            });
  });

  it('should return 200 response with an empty list', (done) => {
    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .query(testQuery2)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.result.content.should.be.of.length(0);
        return done();
      });
  });

  it('should return 200 if user is not part of project team and is not an admin or manager', (done) => {
    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .query(testQuery2)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.result.content.should.be.of.length(0);
        return done();
      });
  });

  it('should return topics even if user is not part of project team but is a manager', (done) => {
    const getStub = sandbox.stub(axios, 'get')
      .onFirstCall().rejects({ status: 404 })
      .onSecondCall().resolves({ data: topicJson });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({});

    request(server)
      .get(apiPath)
      .set({ Authorization: `Bearer ${jwts.manager}` })
      .query(testQuery)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.result.content.should.be.of.length(1);
        sinon.assert.calledTwice(getStub);
        sinon.assert.notCalled(postStub);
        return done();
      });
  });

  it('should return topics even if user is not part of project team but is a admin', (done) => {
    const getStub = sandbox.stub(axios, 'get')
      .onFirstCall().rejects({ })
      .onSecondCall().resolves({ data: topicJson });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({});

    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.manager}`,
      })
      .query(testQuery)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.result.content.should.be.of.length(1);
        sinon.assert.calledTwice(getStub);
        sinon.assert.notCalled(postStub);
        return done();
      });
  });

  // FIXME valid use case
  it('should return 200 response with matching topicLookup', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicJson });
    // mark read

    const postStub = sandbox.stub(axios, 'post').resolves({});
    request(server)
      .get(apiPath)
      .set({ Authorization: `Bearer ${jwts.member}` })
      .query(testQuery)
      .expect(200)
      .end((err) => { // eslint-disable-line
        if (err) {
          return done(err);
        }
        sinon.assert.calledOnce(getStub);
        sinon.assert.calledOnce(postStub);
        return done();
      });
  });
});
