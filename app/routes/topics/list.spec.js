/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, prepareDB, jwts, getDecodedToken } from '../../tests';

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
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicJson });
    // resolves call (with 403) to reference endpoint in helper.userHasAccessToEntity
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 403 } },
    });
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
        // once for reference endpoint call  and once for getting the topics from discourse
        sinon.assert.calledTwice(getStub);
        // should not call post endpoint because it should not call discourse.markTopicPostsRead
        // when using manager access
        sinon.assert.notCalled(postStub);
        return done();
      });
  });

  it('should return topics even if user is not part of project team but is a manager (ref lookup error)', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicJson });
    // resolves call (with 403) to reference endpoint in helper.userHasAccessToEntity
    getStub.withArgs('http://reftest/referenceId').rejects({
      message: 'ERROR_IN_ACCESSING_REF_ENDPOINT',
    });
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
        // once for reference endpoint call  and once for getting the topics from discourse
        sinon.assert.calledTwice(getStub);
        // should not call post endpoint because it should not call discourse.markTopicPostsRead
        // when using manager access
        sinon.assert.notCalled(postStub);
        return done();
      });
  });

  it('should return topics even if user is not part of project team but is a admin', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicJson });
    // rejects to reference endpoint in helper.userHasAccessToEntity
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 403 } },
    });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({});

    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .query(testQuery)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.result.content.should.be.of.length(1);
        // once for reference endpoint call  and once for getting the topics from discourse
        sinon.assert.calledTwice(getStub);
        // should not call post endpoint because it should not call discourse.markTopicPostsRead
        // when using admin access
        sinon.assert.notCalled(postStub);
        return done();
      });
  });

  it('should return topics even if user is not part of project team but is a admin (Ref lookup error)', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicJson });
    // rejects to reference endpoint in helper.userHasAccessToEntity
    getStub.withArgs('http://reftest/referenceId').rejects({
      message: 'ERROR_IN_ACCESSING_REF_ENDPOINT',
    });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({});

    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .query(testQuery)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.result.content.should.be.of.length(1);
        // once for reference endpoint call  and once for getting the topics from discourse
        sinon.assert.calledTwice(getStub);
        // should not call post endpoint because it should not call discourse.markTopicPostsRead
        // when using admin access
        sinon.assert.notCalled(postStub);
        return done();
      });
  });

  // FIXME valid use case
  it('should return 200 response with matching topicLookup', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicJson });

    // resolves call (with 200) to reference endpoint in helper.userHasAccessToEntity
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: [{ userId: memberUser.userId }] } },
    });
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
        // once for reference endpoint call  and once for getting the topics from discourse
        sinon.assert.calledTwice(getStub);
        // should call post endpoint in discourse.markTopicPostsRead as it not using admin access
        sinon.assert.calledOnce(postStub);
        return done();
      });
  });
});
