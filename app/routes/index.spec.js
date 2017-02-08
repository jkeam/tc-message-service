'use strict'
process.env.NODE_ENV = 'test';
require('should');
var request = require('supertest');
var server = require('../../server');
var axios = require('axios');
var sinon = require('sinon');
var util = require('../util');
var sinonStubPromise = require('sinon-stub-promise');
var config = require('config');
sinonStubPromise(sinon);

describe('index', () => {
  var sandbox;
  beforeEach(done => {
    sandbox = sinon.sandbox.create();
    done()
  })
  afterEach(done => {
    sandbox.restore();
    done();
  })
  it('GET /_health should return 200 response', (done) => {
    sandbox.stub(axios, 'get').returnsPromise().resolves({
      status: 200,
      data: {
        result: {}
      }
    });
    request(server)
      .get('/_health')
      .expect(200)
      .end(function(err, res) {
        if (err) {
          return done(err)
        }
        res.body.should.have.property('message', 'All-is-well');
        done()
      })
  });


  it('GET /_health should return 500 response when it discourseURL is unreachable', (done) => {
    var stub = sandbox.stub(axios, 'get');
    stub.withArgs(config.get('discourseURL'), sinon.match.any)
      .returnsPromise().rejects({status: 404, data: { msg: "unreachable"}});

    request(server)
      .get('/_health')
      .expect(500, done)
  });
  it('GET /notexist should return 404 response', (done) => {
    request(server)
      .get('/notexist')
      .expect(404)
      .end(function(err) {
        if (err) {
          return done(err)
        }
        done()
      })
  });
});
