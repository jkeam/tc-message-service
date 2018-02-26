import { clearDB, prepareDB, jwts } from '../../tests';

const _ = require('lodash');
const request = require('supertest');
const axios = require('axios');
const sinon = require('sinon');
const server = require('../../app');
const db = require('../../models');
require('should-sinon');
const topicJson = require('../../tests/topic.json');

describe('PUT /v4/topics/syncUsers', () => {
  const apiPath = '/v4/topics/syncUsers';
  const testBody = {
    reference: 'project',
    referenceId: 1,
  };
  const project = {
    result: {
      status: 200,
      content: {
        members: [
          { userId: 111 },
          { userId: 222 },
          { userId: 40051331 },
        ],
      },
    },
  };
  const dbTopics = [
    { discourseTopicId: 1 },
  ];

  let sandbox;
  let removedUsers = {};
  let addedUsers = {};

  beforeEach((done) => {
    removedUsers = {};
    addedUsers = {};
    sandbox = sinon.sandbox.create();
    sandbox.stub(db.topics, 'findAll').resolves(dbTopics);
    sandbox.stub(db.referenceLookups, 'findOne').resolves({ endpoint: 'https://api/{id}' });
    sandbox.stub(axios, 'put').callsFake((path, payload) => {
      const match = path.match(/^\/t\/(.*)\/remove-allowed-user$/);
      if (match) {
        const user = payload.username;
        removedUsers[user] = removedUsers[user] || [];
        removedUsers[user].push(parseInt(match[1], 10));
        return Promise.resolve({ data: {} });
      }
      return Promise.reject(new Error('Unknown path'));
    });
    prepareDB(done);
  });
  afterEach((done) => {
    sandbox.restore();
    clearDB(done);
  });

  it('should return 403 response without a jwt token', (done) => {
    request(server)
      .put(apiPath)
      .send(testBody)
      .expect(403, done);
  });

  it('should return 403 response with invalid jwt token', (done) => {
    request(server)
      .put(apiPath)
      .set({
        Authorization: 'Bearer wrong',
      })
      .send(testBody)
      .expect(403, done);
  });

  it('should return 403 response if user does not have access to project', (done) => {
    sandbox.stub(axios, 'get').callsFake((path) => {
      if (path === `https://api/${testBody.referenceId}`) {
        return Promise.reject({ response: { status: 403 } });
      }
      return Promise.reject(new Error('Unknown path'));
    });

    request(server)
      .put(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .send(testBody)
      .expect(403)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.should.have.propertyByPath('result', 'content', 'message')
                  .eql('User doesn\'t have access to the project');
        return done();
      });
  });

  it('should return 500 response if some error occurs', (done) => {
    sandbox.stub(axios, 'get').callsFake(() => Promise.reject(new Error('Mock Error')));

    request(server)
      .put(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .send(testBody)
      .expect(500)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.should.have.propertyByPath('result', 'content', 'message')
                  .eql('Error sync users');
        return done();
      });
  });

  it('should return 200 response and user accesses are added/removed', (done) => {
    const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 1 });

    sandbox.stub(axios, 'get').callsFake((path) => {
      if (path === `https://api/${testBody.referenceId}`) {
        return Promise.resolve({ data: project });
      }
      if (path === 'admin/plugins/explorer/queries.json') {
        return Promise.resolve({
          data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
        });
      }
      if (/\/users\/.*\.json\?api_username=.*/.test(path)) {
        return Promise.resolve({ data: {} });
      }
      return Promise.reject(new Error('Unknown path'));
    });


    sandbox.stub(axios, 'post').callsFake((path, payload) => {
      const match = path.match(/^\/t\/(.*)\/invite$/);
      if (match) {
        const user = payload.user;
        addedUsers[user] = addedUsers[user] || [];
        addedUsers[user].push(parseInt(match[1], 10));
        return Promise.resolve({ data: {} });
      } else if (path.match(/admin\/plugins\/explorer\/queries\/.*/)) {
        return Promise.resolve({ data: topicData });
      }
      return Promise.reject(new Error('Unknown path'));
    });

    request(server)
      .put(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .send(testBody)
      .expect(200)
      .end((err) => {
        if (err) {
          return done(err);
        }
        addedUsers.should.deepEqual({
          111: [dbTopics[0].discourseTopicId],
          222: [dbTopics[0].discourseTopicId],
        });
        removedUsers.should.deepEqual({
          333: [dbTopics[0].discourseTopicId],
        });
        return done();
      });
  });

  it('should return 200 response when user leaves project', (done) => {
    sandbox.stub(axios, 'get').callsFake((path) => {
      if (path === `https://api/${testBody.referenceId}`) {
        return Promise.resolve({ data: project });
      }
      if (path === 'admin/plugins/explorer/queries.json') {
        return Promise.resolve({
          data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
        });
      }
      if (/\/users\/.*\.json\?api_username=.*/.test(path)) {
        return Promise.resolve({ data: {} });
      }
      return Promise.reject(new Error('Unknown path'));
    });


    sandbox.stub(axios, 'post').callsFake((path, payload) => {
      const match = path.match(/^\/t\/(.*)\/invite$/);
      if (match) {
        const user = payload.user;
        addedUsers[user] = addedUsers[user] || [];
        addedUsers[user].push(parseInt(match[1], 10));
        return Promise.resolve({ data: {} });
      } else if (path.match(/admin\/plugins\/explorer\/queries\/.*/)) {
        const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 1 });
        topicData.rows[0][topicData.columns.indexOf('allowed_users')] = '40051331,system';
        return Promise.resolve({ data: topicData });
      }
      return Promise.reject(new Error('Unknown path'));
    });

    request(server)
      .put(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .send(_.assign(testBody, { isUserLeaving: true }))
      .expect(200)
      .end((err) => {
        if (err) {
          return done(err);
        }
        addedUsers.should.deepEqual({
          111: [dbTopics[0].discourseTopicId],
          222: [dbTopics[0].discourseTopicId],
        });
        removedUsers.should.deepEqual({
          40051331: [dbTopics[0].discourseTopicId],
        });
        return done();
      });
  });
});
