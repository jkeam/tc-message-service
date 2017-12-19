
/* eslint-disable no-unused-expressions, newline-per-chained-call */

import _ from 'lodash';
import config from 'config';
import { clearDB, prepareDB, jwts, getDecodedToken } from '../../tests';

require('should-sinon');

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');
const util = require('../../util');

const topicJson = require('../../tests/topic.json');

const username = 'test1';

describe('POST /v4/topics ', () => {
  const apiPath = '/v4/topics';
  const testBody = {
    reference: 'reference',
    referenceId: '1',
    tag: 'tag',
    title: 'title',
    body: 'body',
  };
  const testBody2 = {
    reference: 'notexist',
    referenceId: 'notexist',
    tag: 'tag',
    title: 'not exist',
    body: 'not exist',
  };
  const adminUser = {
    handle: getDecodedToken(jwts.admin).handle,
    userId: getDecodedToken(jwts.admin).userId,
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  const getSearchUserResponse = user => ({
    data: {
      result: {
        status: 200,
        content: [
          user,
        ],
      },
    },
  });
  const getMemberAPIResponse = user => ({
    data: {
      result: {
        status: 200,
        content: user,
      },
    },
  });
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
    sandbox.stub(axios, 'get').resolves({
      data: {
        result: {},
      },
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

  it('should return 403 response if error to get referenceLookup endpoint', (done) => {
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

  it('should return 403 response if user does not have access to identity', (done) => {
    const stub = sandbox.stub(axios, 'get');
    stub.rejects({});
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

  it('should return 500 response if 500 for topic creations and errors to get and create discourse user', (done) => {
    // get stub for axios
    const stub = sandbox.stub(axios, 'get');
    // resolves call to reference endpoint in helper.userHasAccessToEntity
    stub.withArgs('http://reftest/1').resolves({
      data: { result: { status: 200, content: [{ userId: adminUser.userId }] } },
    });
    // Rejects the discourse get user call
    stub.withArgs(`/users/${adminUser.userId}.json?api_username=${adminUser.userId}`)
      .rejects({ message: 'DISCOURSE_USER_NOT_FOUND' });
    // resolves the helper.lookupUserHandles call
    stub.withArgs(`${config.memberServiceUrl}/_search`, sinon.match.any)
      .resolves(getSearchUserResponse(adminUser));
    // mocks getSystemUserToken call
    sandbox.stub(util, 'getSystemUserToken').resolves('token');
    // resolves member API call in helper.getTopcoderUser
    stub.withArgs(`${config.memberServiceUrl}/${adminUser.handle}`, sinon.match.any)
      .resolves(getMemberAPIResponse(adminUser));
    // post stub for axios
    const postStub = sandbox.stub(axios, 'post');
    // rejects discourse API call for discourse.createPrivatePost method
    postStub.withArgs('/posts', sinon.match.any).rejects({
      message: 'DISCOURSE_USER_DOES_NOT_EXIST',
      response: { status: 500 },
    });
    // rejects discourse API call for user creation
    postStub.withArgs('/users', sinon.match.any).rejects({
      message: 'DISCOURSE_USER_CREATION_ERROR',
      response: { status: 500 },
    });

    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(500)
      .end((err, resp) => {
        if (err) {
          sinon.assert.fail(err);
          return done();
        }
        const errorMessage = _.get(resp, 'body.result.content.message', '');
        sinon.assert.match(errorMessage, /.*DISCOURSE_USER_CREATION_ERROR/);
        return done();
      });
  });

  it('should return 500 response if 422 for topic creations and errors to get and create discourse user', (done) => {
    // get stub for axios
    const stub = sandbox.stub(axios, 'get');
    // resolves call to reference endpoint in helper.userHasAccessToEntity
    stub.withArgs('http://reftest/1').resolves({
      data: { result: { status: 200, content: [{ userId: adminUser.userId }] } },
    });
    // Rejects the discourse get user call
    stub.withArgs(`/users/${adminUser.userId}.json?api_username=${adminUser.userId}`)
      .rejects({ message: 'DISCOURSE_USER_NOT_FOUND' });
    // resolves the helper.lookupUserHandles call
    stub.withArgs(`${config.memberServiceUrl}/_search`, sinon.match.any)
      .resolves(getSearchUserResponse(adminUser));
    // mocks getSystemUserToken call
    sandbox.stub(util, 'getSystemUserToken').resolves('token');
    // resolves member API call in helper.getTopcoderUser
    stub.withArgs(`${config.memberServiceUrl}/${adminUser.handle}`, sinon.match.any)
      .resolves(getMemberAPIResponse(adminUser));
    // post stub for axios
    const postStub = sandbox.stub(axios, 'post');
    // rejects discourse API call for discourse.createPrivatePost method
    postStub.withArgs('/posts', sinon.match.any).rejects({
      message: 'DISCOURSE_USER_DOES_NOT_EXIST',
      response: { status: 422 },
    });
    // rejects discourse API call for user creation
    postStub.withArgs('/users', sinon.match.any).rejects({
      message: 'DISCOURSE_USER_CREATION_ERROR',
      response: { status: 500 },
    });

    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(500)
      .end((err, resp) => {
        if (err) {
          sinon.assert.fail(err);
          return done();
        }
        const errorMessage = _.get(resp, 'body.result.content.message', '');
        sinon.assert.match(errorMessage, /.*DISCOURSE_USER_CREATION_ERROR/);
        return done();
      });
  });

  it('should return 500 response if 403 for topic creations and errors to get and create discourse user', (done) => {
    // get stub for axios
    const stub = sandbox.stub(axios, 'get');
    // resolves call to reference endpoint in helper.userHasAccessToEntity
    stub.withArgs('http://reftest/1').resolves({
      data: { result: { status: 200, content: [{ userId: adminUser.userId }] } },
    });
    // Rejects the discourse get user call
    stub.withArgs(`/users/${adminUser.userId}.json?api_username=${adminUser.userId}`)
      .rejects({ message: 'DISCOURSE_USER_NOT_FOUND' });
    // resolves the helper.lookupUserHandles call
    stub.withArgs(`${config.memberServiceUrl}/_search`, sinon.match.any)
      .resolves(getSearchUserResponse(adminUser));
    // mocks getSystemUserToken call
    sandbox.stub(util, 'getSystemUserToken').resolves('token');
    // resolves member API call in helper.getTopcoderUser
    stub.withArgs(`${config.memberServiceUrl}/${adminUser.handle}`, sinon.match.any)
      .resolves(getMemberAPIResponse(adminUser));
    // post stub for axios
    const postStub = sandbox.stub(axios, 'post');
    // rejects discourse API call for discourse.createPrivatePost method
    postStub.withArgs('/posts', sinon.match.any).rejects({
      message: 'DISCOURSE_USER_DOES_NOT_EXIST',
      response: { status: 403 },
    });
    // rejects discourse API call for user creation
    postStub.withArgs('/users', sinon.match.any).rejects({
      message: 'DISCOURSE_USER_CREATION_ERROR',
      response: { status: 500 },
    });

    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(500)
      .end((err, resp) => {
        if (err) {
          sinon.assert.fail(err);
          return done();
        }
        const errorMessage = _.get(resp, 'body.result.content.message', '');
        sinon.assert.match(errorMessage, /.*DISCOURSE_USER_CREATION_ERROR/);
        return done();
      });
  });

  it('should return 200 response if error to get user and success to create discourse user', (done) => {
    // sample response for discourse topic calls
    const topicData = Object.assign({}, topicJson, { id: 100 });
    // get stub for axios
    const stub = sandbox.stub(axios, 'get');
    // resolves call to reference endpoint in helper.userHasAccessToEntity
    stub.withArgs('http://reftest/1').resolves({
      data: { result: { status: 200, content: [{ userId: adminUser.userId }] } },
    });
    // Rejects the discourse get user call
    stub.withArgs(`/users/${adminUser.userId}.json?api_username=${adminUser.userId}`)
      .rejects({ message: 'DISCOURSE_USER_NOT_FOUND' });
    // resolves the helper.lookupUserHandles call
    stub.withArgs(`${config.memberServiceUrl}/_search`, sinon.match.any)
      .resolves(getSearchUserResponse(adminUser));
    // mocks getSystemUserToken call
    sandbox.stub(util, 'getSystemUserToken').resolves('token');
    // resolves member API call in helper.getTopcoderUser
    stub.withArgs(`${config.memberServiceUrl}/${adminUser.handle}`, sinon.match.any)
      .resolves(getMemberAPIResponse(adminUser));
    // resolves discourse get topic call for discourse.getTopic
    stub.withArgs(`/t/${topicData.id}.json?include_raw=1`)
    .resolves({ data: topicData });
    // post stub for axios
    const postStub = sandbox.stub(axios, 'post');
    // rejects discourse API call for discourse.createPrivatePost method
    postStub.withArgs('/posts', sinon.match.any)
    .onFirstCall().rejects({
      message: 'DISCOURSE_USER_DOES_NOT_EXIST',
      response: { status: 403 },
    })
    .onSecondCall().resolves({
      data: Object.assign({}, topicData, { topic_id: 100 }),
    });
    // rejects discourse API call for user creation
    postStub.withArgs('/users', sinon.match.any).resolves({
      data: { success: true, user_id: adminUser.userId },
    });
    // put stub for axios
    const putStub = sandbox.stub(axios, 'put');
    putStub.withArgs(`/admin/users/${adminUser.userId}/trust_level`, sinon.match.any)
    .resolves({
      status: 200,
      data: { success: true },
    });

    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(topicData.id);
        return done();
      });
  });

  it('should return 200 response with no matching referenceLookup', (done) => {
    const data = {
      topic_id: 100,
    };
    const topicData = Object.assign({}, topicJson, { id: 100, topic_id: 100 });
    sandbox.stub(axios, 'get').resolves({ data: topicData });
    sandbox.stub(axios, 'post').resolves({
      status: 200,
      data,
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody2)
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.should.have.propertyByPath('result', 'content', 'id').eql(data.topic_id);
        return done();
      });
  });

  it('should return 500 response if error to createPrivatePost with reject', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content',
      },
    };
    sandbox.stub(axios, 'get').resolves({
      data,
    });
    sandbox.stub(axios, 'post').rejects({});
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(500)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 500 response if error to createPrivatePost with invalid status', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content',
      },
    };
    sandbox.stub(axios, 'get').resolves({
      data,
    });
    sandbox.stub(axios, 'post').resolves({
      status: 500,
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(500)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  it('should return 200 response if success to createPrivatePost', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content',
      },
      topic_id: 100,
    };
    const getStub = sandbox.stub(axios, 'get');
    const topicData = Object.assign({}, topicJson, { id: 100 });

    const adminUserId = getDecodedToken(jwts.admin).userId;
    getStub.withArgs('http://reftest/1').resolves({
      data: { result: { status: 200, content: [{ userId: adminUserId }] } },
    });
    getStub.onSecondCall().resolves({
      data: topicData,
    });
    sandbox.stub(axios, 'post').resolves({
      data,
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(200)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });

  // eslint-disable-next-line
  it('should return 200 response if error on first createPrivatePost, success to create user and success on second createPrivatePost', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content',
      },
      topic_id: 100,
    };
    const stub = sandbox.stub(axios, 'get');
    const topicData = Object.assign({}, topicJson, { id: 100 });

    stub.withArgs(`/users/${username}.json`, sinon.match.any)
      .resolves({});
    const adminUserId = getDecodedToken(jwts.admin).userId;
    stub.withArgs('http://reftest/1').resolves({
      data: { result: { status: 200, content: [{ userId: adminUserId }] } },
    });
    stub.withArgs(`/t/${data.topic_id}.json?include_raw=1`).resolves({
      data: topicData,
    });
    stub.withArgs(`${config.memberServiceUrl}/${username}`, sinon.match.any)
      .resolves({
        data: {
          result: {
            status: 200,
            content: {
              handle: username,
              userId: 1,
              firstName: 'fname',
              lastName: 'lName',
              email: 'some@abc.com',
            },
          } },
      });
    stub.resolves({
      data,
    });
    const postStub = sandbox.stub(axios, 'post');

    const userTokenStub = sandbox.stub(util, 'getSystemUserToken').resolves('token'); // eslint-disable-line
    postStub.onFirstCall().returnsPromise = postStub.returnsPromise;
    postStub.onFirstCall().rejects({
      response: {
        status: 403,
      },
    });
    postStub.resolves({
      data,
    });
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(200)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });
  // eslint-disable-next-line
  it('should return 200 response if error on first createPrivatePost, success to create user and success on third createPrivatePost', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content',
      },
      topic_id: 100,
    };
    const stub = sandbox.stub(axios, 'get');
    const topicData = Object.assign({}, topicJson, { id: 100 });

    stub.withArgs(`/users/${username}.json`, sinon.match.any)
      .resolves({});
    stub.withArgs(`${config.memberServiceUrl}/${username}`, sinon.match.any)
      .resolves({
        data,
      });
    stub.withArgs(`/t/${data.topic_id}.json?include_raw=1`).resolves({
      data: topicData,
    });
    stub.resolves({
      data,
    });
    const postStub = sandbox.stub(axios, 'post');
    postStub.onFirstCall().returnsPromise = postStub.returnsPromise;
    postStub.onSecondCall().returnsPromise = postStub.returnsPromise;
    postStub.onFirstCall().rejects({
      response: {
        status: 403,
      },
    });
    postStub.onSecondCall().rejects({
      response: {
        status: 403,
      },
    });
    postStub.resolves({
      data,
    });
    const configStub = sandbox.stub(config, 'get');
    configStub.withArgs('validIssuers')
    .returns('["https://topcoder-newauth.auth0.com/","https://api.topcoder-dev.com"]');
    configStub.withArgs('authSecret').returns('secret');
    configStub.withArgs('authDomain').returns('topcoder.com');
    configStub.withArgs('systemUserIds').returns('0');
    configStub.withArgs('createTopicRetryDelay').returns(0);
    configStub.withArgs('createTopicTimeout').returns(2000);
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .send(testBody)
      .expect(200)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });
});
