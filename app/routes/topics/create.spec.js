
/* eslint-disable no-unused-expressions, newline-per-chained-call */

import _ from 'lodash';
import { clearDB, prepareDB, jwts, getDecodedToken } from '../../tests';

const db = require('../../models');
require('should-sinon');

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');


describe('POST /v4/topics ', () => {
  const apiPath = '/v4/topics';
  const testBody = {
    reference: 'project',
    referenceId: 'referenceId',
    tag: 'tag',
    title: 'title',
    body: 'body',
  };
  // const testBody2 = {
  //   reference: 'notexist',
  //   referenceId: 'notexist',
  //   tag: 'tag',
  //   title: 'not exist',
  //   body: 'not exist',
  // };
  const memberUser = {
    handle: getDecodedToken(jwts.member).handle,
    userId: getDecodedToken(jwts.member).userId,
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  // const adminUser = {
  //   handle: getDecodedToken(jwts.admin).handle,
  //   userId: getDecodedToken(jwts.admin).userId,
  //   firstName: 'fname',
  //   lastName: 'lName',
  //   email: 'some@abc.com',
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
      .post(apiPath)
      .expect(403, done);
  });

  it('should return 403 response with invalid jwt token', (done) => {
    request(server)
      .post(apiPath)
      .set({
        Authorization: 'Bearer wrong',
      })
      .expect(403, done);
  });

  it('should return 400 response without body', (done) => {
    request(server)
      .post(apiPath)
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

  Object.keys(testBody).forEach((key) => {
    it(`should return 400 response without ${key} parameter`, (done) => {
      const body = _.cloneDeep(testBody);
      delete body[key];
      request(server)
        .post(apiPath)
        .set({
          Authorization: `Bearer ${jwts.admin}`,
        })
        .send(body)
        .expect(400)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          res.body.should.have.propertyByPath('result', 'content', 'message')
            .eql(`Validation error: "${key}" is required`);
          return done();
        });
    });
  });

  it('should return 403 response with invalid access', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(403)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 403 response if error to get referenceLookup endpoint (non admin)', (done) => {
    sandbox.stub(axios, 'get').rejects({});
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.manager}`,
      })
      .send(testBody)
      .expect(403)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 200 response if error to get referenceLookup endpoint (admin)', (done) => {
    sandbox.stub(axios, 'get').rejects({});
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(403)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  // it('should return 200 response with no matching referenceLookup', (done) => {
  //   const data = {
  //     topic_id: 100,
  //   };
  //   const topicData = Object.assign({}, _.cloneDeep(topicJson), { id: 100 });
  //   topicData.rows[0][0] = 100;
  //   const stub = sandbox.stub(axios, 'get');
  //   stub.withArgs(sinon.match(/\/admin\/plugins\/explorer\/queries.json/)).resolves({
  //     data: { queries: [{ name: 'Connect_Topics_Query', id: 1 }] },
  //   });
  //   sandbox.stub(axios, 'post').resolves({
  //     status: 200,
  //     data: Object.assign({}, topicData, { topic_id: 100 }),
  //   });

  //   request(server)
  //     .post(apiPath)
  //     .set({
  //       Authorization: `Bearer ${jwts.admin}`,
  //     })
  //     .send(testBody2)
  //     .expect(200)
  //     .end((err, res) => {
  //       if (err) {
  //         return done(err);
  //       }
  //       res.body.should.have.propertyByPath('result', 'content', 'id').eql(data.topic_id);
  //       return done();
  //     });
  // });

  it('should return 500 response if error to createPrivatePost with reject', (done) => {
    const getStub = sandbox.stub(axios, 'get');
    // resolves call (with 200) to reference endpoint in helper.callReferenceEndpoint
    getStub.withArgs('http://reftest/referenceId').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
    const createTopicStub = sandbox.stub(db.topics_backup, 'createTopic').rejects();
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .send(testBody)
      .expect(500)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        // should call findPost on posts model
        createTopicStub.should.have.be.calledOnce;
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Error creating topic');
        return done();
      });
  });
});
