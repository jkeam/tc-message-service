'use strict'
process.env.NODE_ENV = 'test';

require('should');
var _ = require('lodash');
var request = require('supertest');
var jwts = {
  // userId = 40051331
  member: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6W10sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLmNvbSIsImhhbmRsZSI6InRlc3QxIiwiZXhwIjoyNTYzMDc2Njg5LCJ1c2VySWQiOiI0MDA1MTMzMSIsImlhdCI6MTQ2MzA3NjA4OSwiZW1haWwiOiJ0ZXN0QHRvcGNvZGVyLmNvbSIsImp0aSI6ImIzM2I3N2NkLWI1MmUtNDBmZS04MzdlLWJlYjhlMGFlNmE0YSJ9.p13tStpp0A1RJjYJ2axSKCTx7lyWIS3kYtCvs8u88WM",
  // userId = 40051333
  admin: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLmNvbSIsImhhbmRsZSI6InRlc3QxIiwiZXhwIjoyNTYzMDc2Njg5LCJ1c2VySWQiOiI0MDA1MTMzMyIsImlhdCI6MTQ2MzA3NjA4OSwiZW1haWwiOiJ0ZXN0QHRvcGNvZGVyLmNvbSIsImp0aSI6ImIzM2I3N2NkLWI1MmUtNDBmZS04MzdlLWJlYjhlMGFlNmE0YSJ9.uiZHiDXF-_KysU5tq-G82oBTYBR0gV_w-svLX_2O6ts"
};
var username = 'test1';
var config = require('config');
var models = require('../../models')
var server = require('../../../server');
var axios = require('axios');
var sinon = require('sinon');
var util = require('../../util');
var sinonStubPromise = require('sinon-stub-promise');
sinonStubPromise(sinon);

/**
 * Clear the db data
 */
function clearDBPromise() {
  return models.sequelize.sync()
    .then(() => models.topics.truncate({
      cascade: true,
      logging: false
    }))
    .then(() => models.referenceLookups.truncate({
      cascade: true,
      logging: false
    }));
}

/**
 * Clear the db data
 */
function clearDB(done) {
  clearDBPromise()
    .then(() => done())
}


/**
 * Prepare the db data
 */
function prepareDB(done) {
  clearDBPromise()
    .then(() => models.topics.create({
      id: 1,
      reference: 'reference',
      referenceId: 'referenceId',
      discourseTopicId: 1,
      tag: 'tag'
    }))
    .then(() => models.referenceLookups.create({
      reference: 'reference',
      endpoint: 'endpoint{id}'
    }))
    .then(() => done())
}
describe('POST /v4/topics ', () => {
  var apiPath = '/v4/topics';
  var testBody = {
    reference: 'reference',
    referenceId: '1',
    tag: 'tag',
    title: 'title',
    body: 'body'
  };
  var testBody2 = {
    reference: 'notexist',
    referenceId: 'notexist',
    tag: 'tag',
    title: 'not exist',
    body: 'not exist'
  };
  var sandbox;
  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    prepareDB(done)
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
        'Authorization': "Bearer wrong"
      })
      .expect(403, done);
  });

  it('should return 400 response without body', (done) => {
    request(server)
      .post(apiPath)
      .set({
        'Authorization': "Bearer " + jwts.admin
      })
      .expect(400)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        done()
      })
  });

  Object.keys(testBody).forEach(key => {
    it(`should return 400 response without ${key} parameter`, (done) => {
      const body = _.cloneDeep(testBody);
      delete body[key];
      request(server)
        .post(apiPath)
        .set({
          'Authorization': "Bearer " + jwts.admin
        })
        .send(body)
        .expect(400)
        .end(function(err, res) {
          if (err) {
            return done(err)
          }
          res.body.should.have.propertyByPath('result', 'content', 'message')
            .eql(`Validation error: "${key}" is required`);
          done()
        })
    });
  });

  it('should return 403 response with invalid access', (done) => {
    sandbox.stub(axios, 'get').returnsPromise().resolves({
      data: {
        result: {}
      }
    });
    request(server)
      .post(apiPath)
      .set({
        'Authorization': "Bearer " + jwts.admin
      })
      .send(testBody)
      .expect(403)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        done()
      })
  });

  it('should return 403 response if error to get referenceLookup endpoint', (done) => {
    sandbox.stub(axios, 'get').returnsPromise().rejects({});
    request(server)
      .post(apiPath)
      .set({
        'Authorization': "Bearer " + jwts.admin
      })
      .send(testBody)
      .expect(403)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        done()
      })
  });

  it('should return 500 response if error to get user and create discourse user', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content'
      }
    };
    var stub = sandbox.stub(axios, 'get');
    stub.withArgs('/users/' + username + '.json', sinon.match.any)
      .returnsPromise().rejects({});
    stub.withArgs(config.memberServiceUrl + '/' + username, sinon.match.any)
      .returnsPromise().resolves({
        data: data
      });
    stub.returnsPromise().resolves({
      data: data
    });
    sandbox.stub(axios, 'post').returnsPromise().rejects({});
    request(server)
      .post(apiPath)
      .set({
        'Authorization': "Bearer " + jwts.admin
      })
      .send(testBody)
      .expect(500)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        done()
      })
  });

  it('should return 500 response if error to get user and get topcoder user', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content'
      }
    };
    var stub = sandbox.stub(axios, 'get');
    stub.withArgs('/users/' + username + '.json', sinon.match.any)
      .returnsPromise().rejects({});
    stub.withArgs(config.memberServiceUrl + '/' + username, sinon.match.any)
      .returnsPromise().rejects({});
    stub.returnsPromise().resolves({
      data: data
    });
    request(server)
      .post(apiPath)
      .set({
        'Authorization': "Bearer " + jwts.admin
      })
      .send(testBody)
      .expect(500)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        done()
      })
  });

  it('should return 500 response if error to get user and failed to create discourse user', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content'
      }
    };
    var stub = sandbox.stub(axios, 'get');
    stub.withArgs('/users/' + username + '.json', sinon.match.any)
      .returnsPromise().rejects({});
    stub.withArgs(config.memberServiceUrl + '/' + username, sinon.match.any)
      .returnsPromise().resolves({
        data: data
      });
    stub.returnsPromise().resolves({
      data: data
    });
    sandbox.stub(axios, 'post').returnsPromise().resolves({
      data: {
        success: false
      }
    });
    request(server)
      .post(apiPath)
      .set({
        'Authorization': "Bearer " + jwts.admin
      })
      .send(testBody)
      .expect(500)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        done()
      })
  });

  it.skip('should return 200 response if error to get user and success to create discourse user', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content'
      },
      topic_id: 1
    };
    var stub = sandbox.stub(axios, 'get');
    stub.withArgs('/users/' + username + '.json', sinon.match.any)
      .returnsPromise().rejects({});
    stub.withArgs(config.memberServiceUrl + '/' + username, sinon.match.any)
      .returnsPromise().resolves({
        data: data
      });
    stub.returnsPromise().resolves({
      data: data
    });
    const postStub = sandbox.stub(axios, 'post');
    postStub.onFirstCall().returnsPromise = postStub.returnsPromise;
    postStub.onSecondCall().returnsPromise = postStub.returnsPromise;
    postStub.onFirstCall().returnsPromise().rejects({
      response: {
        status: 403
      }
    });
    postStub.onSecondCall().returnsPromise().resolves({
      data: {
        success: true
      }
    });
    postStub.returnsPromise().resolves({
      data: data
    });
    request(server)
      .post(apiPath)
      .set({
        'Authorization': "Bearer " + jwts.admin
      })
      .send(testBody)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        done()
      })
  });

  it.skip('should return 200 response with no matching referenceLookup', (done) => {
    sandbox.stub(axios, 'get').returnsPromise().resolves({});
    const data = {
      topic_id: 1
    };
    sandbox.stub(axios, 'post').returnsPromise().resolves({
      status: 200,
      data: data
    });
    request(server)
      .post(apiPath)
      .set({
        'Authorization': "Bearer " + jwts.admin
      })
      .send(testBody2)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        res.body.should.have.propertyByPath('result', 'content', 'topic_id').eql(data.topic_id);
        done()
      })
  });

  it('should return 500 response if error to createPrivatePost with reject', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content'
      }
    };
    sandbox.stub(axios, 'get').returnsPromise().resolves({
      data: data
    });
    sandbox.stub(axios, 'post').returnsPromise().rejects({});
    request(server)
      .post(apiPath)
      .set({
        'Authorization': "Bearer " + jwts.admin
      })
      .send(testBody)
      .expect(500)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        done()
      })
  });

  it('should return 500 response if error to createPrivatePost with invalid status', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content'
      }
    };
    sandbox.stub(axios, 'get').returnsPromise().resolves({
      data: data
    });
    sandbox.stub(axios, 'post').returnsPromise().resolves({
      status: 500
    });
    request(server)
      .post(apiPath)
      .set({
        'Authorization': "Bearer " + jwts.admin
      })
      .send(testBody)
      .expect(500)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        done()
      })
  });

  it.skip('should return 200 response if success to createPrivatePost', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content'
      },
      topic_id: 1
    };
    sandbox.stub(axios, 'get').returnsPromise().resolves({
      data: data
    });
    sandbox.stub(axios, 'post').returnsPromise().resolves({
      data: data
    });
    request(server)
      .post(apiPath)
      .set({
        'Authorization': "Bearer " + jwts.admin
      })
      .send(testBody)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        done()
      })
  });

  it.skip('should return 200 response if error on first createPrivatePost, success to create user and success on second createPrivatePost', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content'
      },
      topic_id: 1
    };
    const stub = sandbox.stub(axios, 'get');
    stub.withArgs('/users/' + username + '.json', sinon.match.any)
      .returnsPromise().resolves({});
    stub.withArgs(config.memberServiceUrl + '/' + username, sinon.match.any)
      .returnsPromise().resolves({
        data: {
          result: {
            status: 200,
            content: {
              handle: username,
              userId: 1,
              firstName: 'fname',
              lastName: 'lName',
              email: 'some@abc.com'
            }
        }}
      });
    stub.returnsPromise().resolves({
      data: data
    });
    const postStub = sandbox.stub(axios, 'post');

    const userTokenStub = sandbox.stub(util, 'getSystemUserToken')
      .returnsPromise().resolves('token')
    postStub.onFirstCall().returnsPromise = postStub.returnsPromise;
    postStub.onFirstCall().returnsPromise().rejects({
      response: {
        status: 403
      }
    });
    postStub.returnsPromise().resolves({
      data: data
    });
    request(server)
      .post(apiPath)
      .set({
        'Authorization': "Bearer " + jwts.admin
      })
      .send(testBody)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        done()
      })
  });

  it.skip('should return 200 response if error on first createPrivatePost, success to create user and success on third createPrivatePost', (done) => {
    const data = {
      result: {
        status: 200,
        content: 'content'
      },
      topic_id: 1
    };
    const stub = sandbox.stub(axios, 'get');
    stub.withArgs('/users/' + username + '.json', sinon.match.any)
      .returnsPromise().resolves({});
    stub.withArgs(config.memberServiceUrl + '/' + username, sinon.match.any)
      .returnsPromise().resolves({
        data: data
      });
    stub.returnsPromise().resolves({
      data: data
    });
    const postStub = sandbox.stub(axios, 'post');
    postStub.onFirstCall().returnsPromise = postStub.returnsPromise;
    postStub.onSecondCall().returnsPromise = postStub.returnsPromise;
    postStub.onFirstCall().returnsPromise().rejects({
      response: {
        status: 403
      }
    });
    postStub.onSecondCall().returnsPromise().rejects({
      response: {
        status: 403
      }
    });
    postStub.returnsPromise().resolves({
      data: data
    });
    const configStub = sandbox.stub(config, 'get');
    configStub.withArgs('createTopicRetryDelay').returns(0);
    configStub.withArgs('createTopicTimeout').returns(2000);

    request(server)
      .post(apiPath)
      .set({
        'Authorization': "Bearer " + jwts.admin
      })
      .send(testBody)
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        done()
      })
  });
});
