/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, prepareDB, jwts, getDecodedToken } from '../../tests';

require('should-sinon');

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
const _ = require('lodash');

const topicJson = require('../../tests/topic.json');

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
    // sample response for discourse topic calls
    const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 1 });
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicData });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({ data: topicData });

    // resolves discourse's posts endpoint discourse.getPosts
    getStub.withArgs(sinon.match('admin/plugins/explorer/queries.json')).resolves({
      data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
    });

    // resolves call (with 403) to reference endpoint in helper.userHasAccessToEntity
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
        // once for reference endpoint call  and once for getting the topics from discourse
        sinon.assert.calledOnce(getStub);
        // should not call post endpoint because it should not call discourse.markTopicPostsRead
        // when using manager access
        sinon.assert.calledOnce(postStub);
        res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topicData.id);
        res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
        res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
        .eql('2018-02-12 01:35:20.169883');
        return done();
      });
  });

  it('should return topics even if user is not part of project team but is a manager (ref lookup error)', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 1 });
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicData });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({ data: topicData });

    // resolves discourse's posts endpoint discourse.getPosts
    getStub.withArgs(sinon.match('admin/plugins/explorer/queries.json')).resolves({
      data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
    });

    postStub.withArgs(sinon.match('admin/plugins/explorer/queries/.*'))
    .resolves({ data: topicData });

    // resolves call (with 403) to reference endpoint in helper.userHasAccessToEntity
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
        // once for reference endpoint call  and once for getting the topics from discourse
        sinon.assert.calledOnce(getStub);
        // should not call post endpoint because it should not call discourse.markTopicPostsRead
        // when using manager access
        sinon.assert.calledOnce(postStub);
        res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topicData.id);
        res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
        res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
        .eql('2018-02-12 01:35:20.169883');
        return done();
      });
  });

  it('should return topics even if user is not part of project team but is a manager (not in members list)', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 1 });
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicData });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({ data: topicData });

    // resolves discourse's posts endpoint discourse.getPosts
    getStub.withArgs(sinon.match('admin/plugins/explorer/queries.json')).resolves({
      data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
    });

    postStub.withArgs(sinon.match('admin/plugins/explorer/queries/.*'))
    .resolves({ data: topicData });

    // resolves call (with 200) to reference endpoint in helper.userHasAccessToEntity
    // but members list does not the calling user's id
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
        // should not call post endpoint because it should not call discourse.markTopicPostsRead
        // when using manager access
        sinon.assert.calledOnce(postStub);
        res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topicData.id);
        res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
        res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
        .eql('2018-02-12 01:35:20.169883');
        return done();
      });
  });

  it('should return topics even if user is not part of project team but is a admin', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 1 });
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicData });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({ data: topicData });

    // resolves discourse's posts endpoint discourse.getPosts
    getStub.withArgs(sinon.match('admin/plugins/explorer/queries.json')).resolves({
      data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
    });

    postStub.withArgs(sinon.match('admin/plugins/explorer/queries/.*'))
    .resolves({ data: topicData });

    // rejects to reference endpoint in helper.userHasAccessToEntity
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
        // should not call post endpoint because it should not call discourse.markTopicPostsRead
        // when using admin access
        sinon.assert.calledOnce(postStub);
        res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topicData.id);
        res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
        res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
        .eql('2018-02-12 01:35:20.169883');
        return done();
      });
  });

  it('should return topics even if user is not part of project team but is a admin (Ref lookup error)', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 1 });
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicData });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({ data: topicData });

    // resolves discourse's posts endpoint discourse.getPosts
    getStub.withArgs(sinon.match('admin/plugins/explorer/queries.json')).resolves({
      data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
    });

    postStub.withArgs(sinon.match('admin/plugins/explorer/queries/.*'))
    .resolves({ data: topicData });

    // rejects to reference endpoint in helper.userHasAccessToEntity
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
        // once for reference endpoint call  and once for getting the topics from discourse
        sinon.assert.calledOnce(getStub);
        // should not call post endpoint because it should not call discourse.markTopicPostsRead
        // when using admin access
        sinon.assert.calledOnce(postStub);
        res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topicData.id);
        res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
        res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
        .eql('2018-02-12 01:35:20.169883');
        return done();
      });
  });

  it('should return topics even if user is not part of project team but is a admin (non in members list)', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 1 });
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicData });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({ data: topicData });

    // resolves discourse's posts endpoint discourse.getPosts
    getStub.withArgs(sinon.match('admin/plugins/explorer/queries.json')).resolves({
      data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
    });

    postStub.withArgs(sinon.match('admin/plugins/explorer/queries/.*'))
    .resolves({ data: topicData });

    // resolves call (with 200) to reference endpoint in helper.userHasAccessToEntity
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
        // once for reference endpoint call  and once for getting the topics from discourse
        sinon.assert.calledOnce(getStub);
        // should not call post endpoint because it should not call discourse.markTopicPostsRead
        // when using admin access
        sinon.assert.calledOnce(postStub);
        res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topicData.id);
        res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
        res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
        .eql('2018-02-12 01:35:20.169883');
        return done();
      });
  });

  // FIXME valid use case
  it('should return 200 response with matching topicLookup', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 1 });
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicData });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({ data: topicData });

    // resolves discourse's posts endpoint discourse.getPosts
    getStub.withArgs(sinon.match('admin/plugins/explorer/queries.json')).resolves({
      data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
    });

    postStub.withArgs(sinon.match('admin/plugins/explorer/queries/.*'))
    .resolves({ data: topicData });

    // resolves call (with 200) to reference endpoint in helper.userHasAccessToEntity
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
        // once for reference endpoint call  and once for getting the topics from discourse
        sinon.assert.calledOnce(getStub);
        // should call post endpoint in discourse.markTopicPostsRead as it not using admin access
        sinon.assert.calledTwice(postStub);
        res.body.should.have.propertyByPath('result', 'content', '0', 'id').eql(topicData.id);
        res.body.should.have.propertyByPath('result', 'content', '0', 'reference').eql('project');
        res.body.should.have.propertyByPath('result', 'content', '0', 'lastActivityAt')
        .eql('2018-02-12 01:35:20.169883');
        return done();
      });
  });
});
