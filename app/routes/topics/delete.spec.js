/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { jwts, prepareDB, clearDB, getDecodedToken } from '../../tests';

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
const db = require('../../models');
// const _ = require('lodash');
require('should-sinon');

describe('DELETE /v4/topics/:topicId ', () => {
  const topicId = 1;
  const apiPath = `/v4/topics/${topicId}`;
  // let expectedTopic = null;
  // let expectedTopicPosts = null;

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
    prepareDB()
    .then(() => {
      // expectedTopic = topic;
      // expectedTopicPosts = posts;
      // console.log(expectedTopic, expectedTopicPosts);
      done();
    });
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

  it('should return 403 response when user is not member of the project', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [] } } },
    });
    request(server)
      .delete(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(403, done);
  });

  it('should return 200 response with valid jwt token and payload', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    return db.sequelize.query(`Update posts_backup SET "deletedAt"=now() where "topicId"=${topicId};`)
    .then(() => {
      request(server)
        .delete(apiPath)
        .set({
          Authorization: `Bearer ${jwts.member}`,
        })
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          res.body.result.success.should.eql(true);
          return db.topics_backup.findAll({
            where: { deletedAt: { [db.Sequelize.Op.eq]: null } },
            raw: true,
          }).then((topics) => {
            topics.should.length(0);
            return done();
          });
        });
    });
  });

  it('should return 422 response if topic has comments', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
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
        return db.topics_backup.findAll({
          where: { deletedAt: { [db.Sequelize.Op.eq]: null } },
          raw: true,
        }).then((topics) => {
          topics.should.length(1);
          return done();
        });
      });
  });

  it('should return 404 response if topic does not exist', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
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
        return done();
      });
  });

  it('should return 500 response if error getting topic', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const findByIdStub = sandbox.stub(db.topics_backup, 'findById').rejects();
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
        // should call findById on topics model
        findByIdStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error deleting topic');
        return done();
      });
  });

  it('should return 500 response if error deleting topic', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const getTopicPostsCountStub = sandbox.stub(db.posts_backup, 'getTopicPostsCount').rejects();
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
        // should call getTopicPostsCount on topics model
        getTopicPostsCountStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error deleting topic');
        return done();
      });
  });
});
