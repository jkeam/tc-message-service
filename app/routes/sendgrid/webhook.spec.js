import { clearDB, prepareDB, findLast } from '../../tests';

// const Promise = require('bluebird');
const jwt = require('jsonwebtoken');
const config = require('config');
const request = require('supertest');
const axios = require('axios');
const sinon = require('sinon');
const should = require('should');
const util = require('../../util');
require('should-sinon');

const models = require('../../models');
const server = require('../../app');

describe('POST /v4/webhooks/topics/sendgrid', () => {
  const apiPath = `/${config.apiVersion}/webhooks/topics/sendgrid`;

  let sandbox;

  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    prepareDB(done);
  });
  afterEach((done) => {
    sandbox.restore();
    clearDB(done);
  });

  it('should be able to process status failure', (done) => {
    models.emailLogs.count().then((initialCount) => {
      const getHttpClientStub = sandbox.stub(util, 'getHttpClient');
      getHttpClientStub.returns(axios);

      const postStub = sandbox.stub(axios, 'post');
      const getStub = sandbox.stub(axios, 'get');

      const authUrl = `${config.get('identityServiceEndpoint')}authorizations/`;
      const authStr = 'clientId=&secret=';
      const getAuthOpts = {
        timeout: 4000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      };
      postStub.withArgs(authUrl, authStr, getAuthOpts)
              .resolves({
                data: { result: { status: 200, content: { token: 'mock' } } },
              });

      const getUsersOpts = {
        headers: {
          Authorization: 'Bearer mock',
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        params: {
          fields: 'handle,id,email',
          filter: 'email=jon@gmail.com',
        },
      };
      getStub.withArgs(`${config.get('identityServiceEndpoint')}users`, getUsersOpts).resolves({
        data: { result: { status: 200, content: [{ id: 1 }] } },
      });

      request(server)
        .post(apiPath)
        .field('text', 'Hi everyone!')
        .field('subject', 'Hi')
        .field('cc', 'bob@gmail.com')
        .field('envelope', '{"from": "jon@gmail.com", "to": ["000000001/token@gmail.com"]}')
        .expect(200)
        .end((err) => {
          should.not.exist(err);
          getHttpClientStub.calledOnce.should.be.true();
          getStub.calledOnce.should.be.true();
          postStub.calledOnce.should.be.true();
          models.emailLogs.count().then((afterCount) => {
            afterCount.should.be.eql(initialCount + 1);
            findLast(models.emailLogs).then((emailLog) => {
              emailLog.fromAddress.should.be.eql('jon@gmail.com');
              emailLog.status.should.be.eql('fail');
              done();
            });
          });
        });
    });
  });

  it('should be able to process status successfully', (done) => {
    models.emailLogs.count().then((initialCount) => {
      const getHttpClientStub = sandbox.stub(util, 'getHttpClient');
      getHttpClientStub.returns(axios);

      const postStub = sandbox.stub(axios, 'post');
      const getStub = sandbox.stub(axios, 'get');

      const authUrl = `${config.get('identityServiceEndpoint')}authorizations/`;
      const authStr = 'clientId=&secret=';
      const getAuthOpts = {
        timeout: 4000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      };
      postStub.withArgs(authUrl, authStr, getAuthOpts)
              .resolves({
                data: { result: { status: 200, content: { token: 'mock' } } },
              });

      const getUsersOpts = {
        headers: {
          Authorization: 'Bearer mock',
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        params: {
          fields: 'handle,id,email',
          filter: 'email=jon@gmail.com',
        },
      };
      getStub.withArgs(`${config.get('identityServiceEndpoint')}users`, getUsersOpts).resolves({
        data: { result: { status: 200, content: [{ id: 1 }] } },
      });

      const jwtStub = sandbox.stub(jwt, 'sign');
      jwtStub.returns('junk.junk.supersecret');

      request(server)
        .post(apiPath)
        .field('text', 'Hi everyone!')
        .field('subject', 'Hi')
        .field('cc', 'bob@gmail.com')
        .field('envelope', '{"from": "jon@gmail.com", "to": ["000000001/supersecret@gmail.com"]}')
        .expect(200)
        .end((err) => {
          should.not.exist(err);
          getHttpClientStub.calledOnce.should.be.true();
          getStub.calledOnce.should.be.true();
          postStub.calledOnce.should.be.true();
          jwtStub.calledOnce.should.be.true();
          models.emailLogs.count().then((afterCount) => {
            afterCount.should.be.eql(initialCount + 1);
            findLast(models.emailLogs).then((emailLog) => {
              emailLog.fromAddress.should.be.eql('jon@gmail.com');
              emailLog.status.should.be.eql('success');
              done();
            });
          });
        });
    });
  });
});
