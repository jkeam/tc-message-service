/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, prepareDB, jwts, getDecodedToken } from '../../tests';

require('should-sinon');

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
// const _ = require('lodash');
const Promise = require('bluebird');

const db = require('../../models');
// const topicJson = require('../../tests/topic.json');

function assertTopicAndPost(topicId, assertCallback, done) {
  // test topic
  return Promise.all([
    db.topics_backup.findById(topicId),
    db.posts_backup.findOne({ topicId }),
  ])
  .then((response) => {
    const topic = response[0];
    const topicPost = response[1];
    assertCallback(topic, topicPost);
    return done();
  })
  .catch(() => done());
}

describe('GET /v4/topics ', () => {
  const apiPath = '/v4/topics';
  const testQuery = {
    filter: 'tag=tag&reference=project&referenceId=referenceId',
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

  it('should return 403 if user is not part of project team and is not an admin or manager', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();

    // resolves call (with 403) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 403 } },
    });
    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .query(testQuery)
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

  it('should return 403 if user is not part of project team and is not an admin or manager', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();

    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    // but members list does not include the calling user's id
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: 123 }] } } },
    });
    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .query(testQuery)
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

  it('should return topics even if user is not part of project team but is a manager', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();
    // stub for updateUserStats method of PostUserStats modal
    const updateStatsStub = sandbox.stub(db.post_user_stats_backup, 'updateUserStats').resolves();

    // resolves call (with 403) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 403 } },
    });

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
        // once for reference endpoint call
        sinon.assert.calledOnce(getStub);
        // should call UPDATE on post user stats table
        updateStatsStub.should.have.be.calledOnce;
        // asserts the response with test data(created during test boostrap)
        return assertTopicAndPost(1, (topic, topicPost) => {
          res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topic.id);
          res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
          // console.log(topicPost.updatedAt, 'updatedAt');
          res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
          .eql(topicPost.updatedAt);
        }, done);
      });
  });

  it('should return topics even if user is not part of project team but is a manager (ref lookup error)', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();
    // stub for updateUserStats method of PostUserStats modal
    const updateStatsStub = sandbox.stub(db.post_user_stats_backup, 'updateUserStats').resolves();

    // resolves call (with 403) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').rejects({
      message: 'ERROR_IN_ACCESSING_REF_ENDPOINT',
    });


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
        // once for reference endpoint call
        sinon.assert.calledOnce(getStub);
        // should call UPDATE on post user stats table
        updateStatsStub.should.have.be.calledOnce;
        // asserts the response with test data(created during test boostrap)
        return assertTopicAndPost(1, (topic, topicPost) => {
          res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topic.id);
          res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
          // console.log(topicPost.updatedAt, 'updatedAt');
          res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
          .eql(topicPost.updatedAt);
        }, done);
      });
  });

  it('should return topics even if user is not part of project team but is a manager (not in members list)', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();
    // stub for updateUserStats method of PostUserStats modal
    const updateStatsStub = sandbox.stub(db.post_user_stats_backup, 'updateUserStats').resolves();

    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    // but members list does not include the calling user's id
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });

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
        sinon.assert.calledOnce(getStub);
        // should call UPDATE on post user stats table
        updateStatsStub.should.have.be.calledOnce;
        // asserts the response with test data(created during test boostrap)
        return assertTopicAndPost(1, (topic, topicPost) => {
          res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topic.id);
          res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
          // console.log(topicPost.updatedAt, 'updatedAt');
          res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
          .eql(topicPost.updatedAt);
        }, done);
      });
  });

  it('should return topics even if user is not part of project team but is a admin', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();
    // stub for updateUserStats method of PostUserStats modal
    const updateStatsStub = sandbox.stub(db.post_user_stats_backup, 'updateUserStats').resolves();

    // rejects to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 403 } },
    });

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
        sinon.assert.calledOnce(getStub);
        // should call UPDATE on post user stats table
        updateStatsStub.should.have.be.calledOnce;
        // asserts the response with test data(created during test boostrap)
        return assertTopicAndPost(1, (topic, topicPost) => {
          res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topic.id);
          res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
          // console.log(topicPost.updatedAt, 'updatedAt');
          res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
          .eql(topicPost.updatedAt);
        }, done);
      });
  });

  it('should return topics even if user is not part of project team but is a admin (Ref lookup error)', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();
    // stub for updateUserStats method of PostUserStats modal
    const updateStatsStub = sandbox.stub(db.post_user_stats_backup, 'updateUserStats').resolves();

    // rejects to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').rejects({
      message: 'ERROR_IN_ACCESSING_REF_ENDPOINT',
    });

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
        // once for reference endpoint call
        sinon.assert.calledOnce(getStub);
        // should call UPDATE on post user stats table
        updateStatsStub.should.have.be.calledOnce;
        // asserts the response with test data(created during test boostrap)
        return assertTopicAndPost(1, (topic, topicPost) => {
          res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topic.id);
          res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
          // console.log(topicPost.updatedAt, 'updatedAt');
          res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
          .eql(topicPost.updatedAt);
        }, done);
      });
  });

  it('should return topics even if user is not part of project team but is a admin (not in members list)', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();
    // stub for updateUserStats method of PostUserStats modal
    const updateStatsStub = sandbox.stub(db.post_user_stats_backup, 'updateUserStats').resolves();

    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    // but members list does not the calling user's id
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });

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
        // once for reference endpoint call
        sinon.assert.calledOnce(getStub);
        // should call UPDATE on post user stats table
        updateStatsStub.should.have.be.calledOnce;
        // asserts the response with test data(created during test boostrap)
        return assertTopicAndPost(1, (topic, topicPost) => {
          res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topic.id);
          res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
          // console.log(topicPost.updatedAt, 'updatedAt');
          res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
          .eql(topicPost.updatedAt);
        }, done);
      });
  });

  it('should return 200 response with matching topicLookup', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();
    // stub for updateUserStats method of PostUserStats modal
    const updateStatsStub = sandbox.stub(db.post_user_stats_backup, 'updateUserStats').resolves();

    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });

    request(server)
      .get(apiPath)
      .set({ Authorization: `Bearer ${jwts.member}` })
      .query(testQuery)
      .expect(200)
      .end((err, res) => { // eslint-disable-line
        if (err) {
          return done(err);
        }
        // once for reference endpoint call
        sinon.assert.calledOnce(getStub);
        // should call UPDATE on post user stats table
        updateStatsStub.should.have.be.calledOnce;
        // asserts the response with test data(created during test boostrap)
        return assertTopicAndPost(1, (topic, topicPost) => {
          res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topic.id);
          res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
          // console.log(topicPost.updatedAt, 'updatedAt');
          res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
          .eql(topicPost.updatedAt);
        }, done);
      });
  });

  it('should return 200 response even if error in updateUserStats', (done) => {
    const getStub = sandbox.stub(axios, 'get').resolves();
    // stub for updateUserStats method of PostUserStats modal
    const updateStatsStub = sandbox.stub(db.post_user_stats_backup, 'updateUserStats').rejects();

    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });

    request(server)
      .get(apiPath)
      .set({ Authorization: `Bearer ${jwts.member}` })
      .query(testQuery)
      .expect(200)
      .end((err, res) => { // eslint-disable-line
        if (err) {
          return done(err);
        }
        // once for reference endpoint call
        sinon.assert.calledOnce(getStub);
        // should call UPDATE on post user stats table
        updateStatsStub.should.have.be.calledOnce;
        // asserts the response with test data(created during test boostrap)
        return assertTopicAndPost(1, (topic, topicPost) => {
          res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topic.id);
          res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
          // console.log(topicPost.updatedAt, 'updatedAt');
          res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
          .eql(topicPost.updatedAt);
        }, done);
      });
  });
});
