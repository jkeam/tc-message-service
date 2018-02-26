
/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, prepareDB, jwts } from '../../tests';


const request = require('supertest');
const topicJson = require('../../tests/topic.json');
const server = require('../../app');

const axios = require('axios');
const sinon = require('sinon');

require('should-sinon');

describe('GET /v4/topics/:topicId', () => {
  const apiPathPrefix = '/v4/topics/';
  const apiPath = `${apiPathPrefix}1`;

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

  it('should return 404 response if no matching topic', (done) => {
    sandbox.stub(axios, 'get').resolves({ data: { result: {} } });
    request(server)
            .get(`${apiPathPrefix}10000`)
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

  it('should return 200 response when called by project member and should mark topic read', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, topicJson, { id: 1 });
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicData });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({ data: topicData });

    // resolves discourse's posts endpoint discourse.getPosts
    getStub.withArgs(sinon.match('admin/plugins/explorer/queries.json')).resolves({
      data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
    });

    postStub.withArgs(sinon.match('admin/plugins/explorer/queries/.*'))
    .resolves({ data: topicData });


    request(server)
      .get(`${apiPathPrefix}1`)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        sinon.assert.calledTwice(postStub);
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(topicData.id);
        res.body.should.have.propertyByPath('result', 'content', 'reference').eql('project');
        res.body.should.have.propertyByPath('result', 'content', 'posts').length(1);
        res.body.should.have.propertyByPath('result', 'content', 'lastActivityAt').eql('2018-02-12 01:35:20.169883Z');
        return done();
      });
  });

  it('should return 200 response when called by admin not on project team and not mark topic as read', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, topicJson, { id: 1 });
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicData });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({ data: topicData });

    // resolves discourse's posts endpoint discourse.getPosts
    getStub.withArgs(sinon.match('admin/plugins/explorer/queries.json')).resolves({
      data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
    });

    postStub.withArgs(sinon.match('admin/plugins/explorer/queries/.*'))
    .resolves({ data: topicData });

    request(server)
      .get(`${apiPathPrefix}1`)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(topicData.id);
        res.body.should.have.propertyByPath('result', 'content', 'reference').eql('project');
        res.body.should.have.propertyByPath('result', 'content', 'posts').length(1);
        res.body.should.have.propertyByPath('result', 'content', 'lastActivityAt').eql('2018-02-12 01:35:20.169883Z');
        return done();
      });
  });

  it('should return 200 response with new additional post, when there is a new post after get topic call', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, topicJson, { id: 1 });
    topicData.rows.push(topicData.rows[0]);
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicData });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({ data: topicData });

    // resolves discourse's posts endpoint discourse.getPosts
    getStub.withArgs(sinon.match('admin/plugins/explorer/queries.json')).resolves({
      data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
    });

    postStub.withArgs(sinon.match('admin/plugins/explorer/queries/.*'))
    .resolves({ data: topicData });

    request(server)
      .get(`${apiPathPrefix}1`)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(topicData.id);
        res.body.should.have.propertyByPath('result', 'content', 'reference').eql('project');
        // although /topic/{topicId} returns topic with only 4 posts,
        // /topic/{topicId}/posts returns 5 posts, so, final output should have 5 posts
        res.body.should.have.propertyByPath('result', 'content', 'posts').length(2);
        // lastActivityAt should refelct the updated_at date of the newest post
        res.body.should.have.propertyByPath('result', 'content', 'lastActivityAt').eql('2018-02-12 01:35:20.169883Z');
        return done();
      });
  });


  xit('should return 500 response if error to get topic', (done) => {
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
