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
var config = require('config');
var server = require('../../../server');
var axios = require('axios');
var sinon = require('sinon');
var sinonStubPromise = require('sinon-stub-promise');
sinonStubPromise(sinon);

describe('POST /v4/threads/:threadId/messages ', () => {
    var apiPath = '/v4/threads/:threadId/messages';
    var testBody = {
        message: 'test message'
    };
    var sandbox;
    beforeEach(function() {
        sandbox = sinon.sandbox.create();
    });
    afterEach(() => {
        sandbox.restore();
    });
    it('should return 403 response without a jwt token', (done) => {
        request(server)
            .post(apiPath)
            .send(testBody)
            .expect(403, done);
    });

    it('should return 403 response with invalid jwt token', (done) => {
        request(server)
            .post(apiPath)
            .set({
                'Authorization': "Bearer wrong"
            })
            .send(testBody)
            .expect(403, done);
    });

    it('should return 200 response with valid jwt token and payload', (done) => {
        sandbox.stub(axios, 'post').returnsPromise().resolves({});
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
                res.body.should.have.property('message', 'Message created');
                done()
            })
    });

    it('should return 500 response with error response', (done) => {
        sandbox.stub(axios, 'post').returnsPromise().rejects({
            response: {
                status: 500
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
                res.body.should.have.property('message', 'Error creating thread');
                done()
            })
    });
});