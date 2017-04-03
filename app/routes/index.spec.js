
require('should');
const request = require('supertest');

const axios = require('axios');
const sinon = require('sinon');
const config = require('config');

describe('index', () => {
  const server = require('../app'); // eslint-disable-line
  let sandbox;
  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    done();
  });
  afterEach((done) => {
    sandbox.restore();
    done();
  });

  it('GET /_health should return 200 response', (done) => {
    sandbox.stub(axios, 'get').resolves({
      status: 200,
      data: {
        result: {},
      },
    });
    request(server)
      .get('/_health')
      .expect(200)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.should.have.property('message', 'All-is-well');
        return done();
      });
  });


  it('GET /_health should return 500 response when it discourseURL is unreachable', (done) => {
    const stub = sandbox.stub(axios, 'get');
    stub.withArgs(config.get('discourseURL'), sinon.match.any)
      .rejects({ status: 404, data: { msg: 'unreachable' } });

    request(server)
      .get('/_health')
      .expect(500, done);
  });
  it('GET /notexist should return 404 response', (done) => {
    request(server)
      .get('/notexist')
      .expect(404)
      .end((err) => {
        if (err) {
          return done(err);
        }
        return done();
      });
  });
});
