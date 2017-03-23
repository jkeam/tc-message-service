
/* eslint-disable no-unused-expressions, newline-per-chained-call */

import _ from 'lodash';
import config from 'config';
import { clearDB, prepareDB, jwts } from '../../tests';

require('should-sinon');

const request = require('supertest');
const server = require('../../app');
const axios = require('axios');
const sinon = require('sinon');

// const topicJson = require('../../tests/topic.json');

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

  it('should return 500 response if error to get user and create discourse user', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content',
      },
    };
    const stub = sandbox.stub(axios, 'get');
    stub.withArgs(`/users/${username}.json`, sinon.match.any)
      .rejects({});
    stub.withArgs(`${config.memberServiceUrl}/${username}`, sinon.match.any)
      .resolves({
        data,
      });
    stub.resolves({
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

  it.skip('should return 500 response if error to get user and failed to create discourse user', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content',
      },
    };
    const stub = sandbox.stub(axios, 'get');
    stub.withArgs(`/users/${username}.json`, sinon.match.any)
      .rejects({});
    stub.withArgs(`${config.memberServiceUrl}/${username}`, sinon.match.any)
      .resolves({ data });
    stub.resolves({ data });
    const postStub = sandbox.stub(axios, 'post');
    postStub.onFirstCall().rejects({
      response: {
        status: 422,
      },
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

  it.skip('should return 200 response if error to get user and success to create discourse user', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content',
      },
      topic_id: 1,
    };
    const stub = sandbox.stub(axios, 'get');
    stub.withArgs(`/users/${username}.json`, sinon.match.any)
      .rejects({});
    stub.withArgs(`${config.memberServiceUrl}/${username}`, sinon.match.any)
      .resolves({
        data,
      });
    stub.resolves({
      data,
    });
    const postStub = sandbox.stub(axios, 'post');
    // postStub.onFirstCall().returnsPromise = postStub.returnsPromise;
    // postStub.onSecondCall().returnsPromise = postStub.returnsPromise;
    postStub.onFirstCall().rejects({
      response: {
        status: 403,
      },
    });
    postStub.onSecondCall().resolves({
      data: {
        success: true,
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

  it.skip('should return 200 response with no matching referenceLookup', (done) => {
    sandbox.stub(axios, 'get').resolves({});
    const data = {
      topic_id: 1,
    };
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
        res.body.should.have.propertyByPath('result', 'content', 'topic_id').eql(data.topic_id);
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

  it.skip('should return 200 response if success to createPrivatePost', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content',
      },
      topic_id: 1,
    };
    sandbox.stub(axios, 'get').resolves({
      data,
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
  it.skip('should return 200 response if error on first createPrivatePost, success to create user and success on second createPrivatePost', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content',
      },
      topic_id: 1,
    };
    const stub = sandbox.stub(axios, 'get');
    stub.withArgs(`/users/${username}.json`, sinon.match.any)
      .resolves({});
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
  it.skip('should return 200 response if error on first createPrivatePost, success to create user and success on third createPrivatePost', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content',
      },
      topic_id: 1,
    };
    const stub = sandbox.stub(axios, 'get');
    stub.withArgs(`/users/${username}.json`, sinon.match.any)
      .resolves({});
    stub.withArgs(`${config.memberServiceUrl}/${username}`, sinon.match.any)
      .resolves({
        data,
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
