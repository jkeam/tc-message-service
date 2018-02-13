/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { jwts, prepareDB, clearDB } from '../../tests';

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
const models = require('../../models');
const topicJson = require('../../tests/topic.json');
const _ = require('lodash');
require('should-sinon');

describe('DELETE /v4/topics/:topicId ', () => {
  const apiPath = '/v4/topics/1';
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

    const deleteStub = sandbox.stub(axios, 'delete').resolves({});
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
              sinon.assert.calledOnce(getStub);
              sinon.assert.calledOnce(deleteStub);
              return models.topics.findAll().then((topics) => {
                topics.should.length(0);
                return done();
              });
            });
  });

  it('should return 200 response if topic does not exist in db but in discourse', (done) => {
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
    const deleteStub = sandbox.stub(axios, 'delete').resolves({});
    request(server)
            .delete('/v4/topics/2000')
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .expect(200)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              res.body.result.success.should.eql(true);
              sinon.assert.notCalled(getStub);
              sinon.assert.calledOnce(deleteStub);
              return done();
            });
  });

  it('should return 200 response if topic exist in db but not in discourse', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 1 });
    topicData.rows = [];
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicData });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({ data: topicData });

    // resolves discourse's posts endpoint discourse.getPosts
    getStub.withArgs(sinon.match('admin/plugins/explorer/queries.json')).resolves({
      data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
    });

    postStub.withArgs(sinon.match('admin/plugins/explorer/queries/.*'))
    .resolves({ data: topicData });

    const deleteStub = sandbox.stub(axios, 'delete').resolves({});
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
              sinon.assert.notCalled(getStub);
              sinon.assert.notCalled(deleteStub);
              return done();
            });
  });

  it('should return 422 response if topic has comments', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 1 });
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
    const deleteStub = sandbox.stub(axios, 'delete').resolves({});
    request(server)
            .delete(apiPath)
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .expect(422)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              res.body.should.have.propertyByPath('result', 'content', 'message')
                        .eql('Topic has comments and can not be deleted');
              sinon.assert.notCalled(getStub);
              sinon.assert.notCalled(deleteStub);
              return models.topics.findAll().then((topics) => {
                topics.should.length(1);
                return done();
              });
            });
  });

  it('should return 404 response if topic does not exist', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 1 });
    topicData.rows = [];
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicData });
    // mark read
    const postStub = sandbox.stub(axios, 'post').resolves({ data: topicData });

    // resolves discourse's posts endpoint discourse.getPosts
    getStub.withArgs(sinon.match('admin/plugins/explorer/queries.json')).resolves({
      data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
    });

    postStub.withArgs(sinon.match('admin/plugins/explorer/queries/.*'))
    .resolves({ data: topicData });
    const deleteStub = sandbox.stub(axios, 'delete').resolves({});
    request(server)
      .delete('/v4/topics/2000')
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(404)
      .end((err, res) => {
        if (err) {
          throw done(err);
        }
        res.body.should.have.propertyByPath('result', 'content', 'message')
                  .eql('Topic does not exist');
        sinon.assert.notCalled(getStub);
        sinon.assert.notCalled(deleteStub);
        return done();
      });
  });

  it('should return 500 response if error getting topic', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 1 });
    const getStub = sandbox.stub(axios, 'get').resolves({ data: topicData });
    // mark read
    sandbox.stub(axios, 'post').rejects({
      response: {
        status: 500,
      },
    });

    // resolves discourse's posts endpoint discourse.getPosts
    getStub.withArgs(sinon.match('admin/plugins/explorer/queries.json')).resolves({
      data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
    });

    const deleteStub = sandbox.stub(axios, 'delete').resolves({});
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
              sinon.assert.notCalled(getStub);
              sinon.assert.notCalled(deleteStub);
              res.body.should.have.propertyByPath('result', 'content', 'message')
                        .eql('Error deleting topic');
              return done();
            });
  });

  it('should return 500 response if error deleting topic', (done) => {
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
              sinon.assert.notCalled(getStub);
              res.body.should.have.propertyByPath('result', 'content', 'message')
                        .eql('Error deleting topic');
              return done();
            });
  });
});
