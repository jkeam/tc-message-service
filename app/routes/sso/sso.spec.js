'use strict'
process.env.NODE_ENV = 'test';

require('should');
var _ = require('lodash');
var request = require('supertest');

var config = require('config');
var server = require('../../../server');

var axios = require('axios');
var sinon = require('sinon');
var sinonStubPromise = require('sinon-stub-promise');
sinonStubPromise(sinon);


var ssoQuery = '?sso=bm9uY2U9YWUxNzU0NDA5YWU1ZmZiMjRlMTQxNGNjY2Y3NTQ0ODUmcmV0dXJu%0AX3Nzb191cmw9aHR0cCUzQSUyRiUyRmxvY2FsaG9zdCUyRnNlc3Npb24lMkZz%0Ac29fbG9naW4%3D%0A&sig=bafdc136dd70235e05179b188e4432b51d5b19b42aa095e8c69c1564767e2f77';

var userToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6W10sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLmNvbSIsImhhbmRsZSI6InRlc3RfdXNlciIsImV4cCI6MjU2MzA3NjY4OSwidXNlcklkIjoiNDAwNTEzMzEiLCJpYXQiOjE0NjMwNzYwODksImVtYWlsIjoidGVzdEB0b3Bjb2Rlci5jb20iLCJqdGkiOiJiMzNiNzdjZC1iNTJlLTQwZmUtODM3ZS1iZWI4ZTBhZTZhNGEifQ.gBSH_XO3rnxyTx5ZhOSAKxDF7fg9Xm1hC_pAz1M-yGg';
var adminToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLmNvbSIsImhhbmRsZSI6InRlc3RfYWRtaW4iLCJleHAiOjI1NjMwNzY2ODksInVzZXJJZCI6IjUwMDUxMzMzIiwiaWF0IjoxNDYzMDc2MDg5LCJlbWFpbCI6InRlc3RAdG9wY29kZXIuY29tIiwianRpIjoiYjMzYjc3Y2QtYjUyZS00MGZlLTgzN2UtYmViOGUwYWU2YTRhIn0.ujS_N61dSSMouprQbohUCLkZAq8VSoCwI85i7FagOFo';

var userData = {
  "id": "test_user",
  "result": {
    "success": true,
    "status": 200,
    "metadata": null,
    "content": {
      "id": "40051331",
      "modifiedBy": null,
      "modifiedAt": "2016-06-01T16:57:47.000Z",
      "createdBy": null,
      "createdAt": "2002-02-06T18:06:40.000Z",
      "handle": "test_user",
      "email": "user@topcoder.com",
      "firstName": "F_user",
      "lastName": "L_user",
      "credential": {
        "activationCode": "3DZ9IVH4",
        "resetToken": null,
        "hasPassword": true
      },
      "status": "A",
      "country": null,
      "regSource": null,
      "utmSource": null,
      "utmMedium": null,
      "utmCampaign": null,
      "active": true,
      "profile": null,
      "emailActive": true
    }
  },
  "version": "v3"
};

var adminData = {
  "id": "test_admin",
  "result": {
    "success": true,
    "status": 200,
    "metadata": null,
    "content": {
      "id": "50051333",
      "modifiedBy": null,
      "modifiedAt": "2016-06-01T16:57:47.000Z",
      "createdBy": null,
      "createdAt": "2002-02-06T18:06:40.000Z",
      "handle": "test_admin",
      "email": "admin@topcoder.com",
      "firstName": "F_admin",
      "lastName": "L_admin",
      "credential": {
        "activationCode": "3DZ9IVH4",
        "resetToken": null,
        "hasPassword": true
      },
      "status": "A",
      "country": null,
      "regSource": null,
      "utmSource": null,
      "utmMedium": null,
      "utmCampaign": null,
      "active": true,
      "profile": null,
      "emailActive": true
    }
  },
  "version": "v3"
};

describe('GET /sso ', () => {
    var apiPath = '/sso';
    var apiPathWithQuery = apiPath + ssoQuery;

    var sandbox;
    beforeEach((done) => {
        sandbox = sinon.sandbox.create();
        done();
    });

    afterEach((done) => {
        sandbox.restore();
        done();
    });


    it('should redirect to login without sso and sig payload', (done) => {
        request(server)
            .get(apiPath)
            .end(function(err, res) {
                res.header['location'].should.equal(config.discourseSSO.loginUrl);
                done();
            });
    });

    it('should redirect to login with invalid sso and sig payload', (done) => {
        request(server)
            .get(apiPath + '?sso=invalid&sig=invalid')
            .end(function(err, res) {
                res.header['location'].should.equal(config.discourseSSO.loginUrl);
                done();
            });
    });

    it('should redirect to login with no jwtToken cookie', (done) => {
        request(server)
            .get(apiPathWithQuery)
            .end(function(err, res) {
                res.header['location'].should.equal(config.discourseSSO.loginUrl);
                done();
            });
    });

    it('should redirect to login with invalid jwtToken cookie', (done) => {
        request(server)
            .get(apiPathWithQuery)
            .set('Cookie', [config.discourseSSO.loginCookieName + '=invalid'])
            .end(function(err, res) {
                res.header['location'].should.equal(config.discourseSSO.loginUrl);
                done();
            });
    });

    it('should redirect to login with invalid identity-service response', (done) => {
        sandbox.stub(axios, 'get').returnsPromise().resolves({
            data: {
                result: {}
            }
        });

        request(server)
            .get(apiPathWithQuery)
            .set('Cookie', [config.discourseSSO.loginCookieName + '=' + userToken])
            .end(function(err, res) {
                res.header['location'].should.equal(config.discourseSSO.loginUrl);
                done();
            });
    });

    it('should redirect to discourse sso login with valid data for normal user', (done) => {
        sandbox.stub(axios, 'get').returnsPromise().resolves({
            data: userData
        });

        request(server)
            .get(apiPathWithQuery)
            .set('Cookie', [config.discourseSSO.loginCookieName + '=' + userToken])
            .end(function(err, res) {
                res.header['location'].should.startWith(config.discourseURL + '/session/sso_login?');
                done();
            });
    });


    it('should redirect to discourse sso login with valid data for admin user', (done) => {
        sandbox.stub(axios, 'get').returnsPromise().resolves({
            data: adminData
        });

        request(server)
            .get(apiPathWithQuery)
            .set('Cookie', [config.discourseSSO.loginCookieName + '=' + adminToken])
            .end(function(err, res) {
                res.header['location'].should.startWith(config.discourseURL + '/session/sso_login?');
                done();
            });
    });
});

