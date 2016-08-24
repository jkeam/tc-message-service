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
        .then(()=> models.topics.create({
            id:1,
            reference: 'reference',
            referenceId: 'referenceId',
            discourseTopicId: 1,
            tag:'tag'
        }))
        .then(() => done())
}

describe('GET /v4/topics/:topicId', () => {
    var apiPathPrefix = '/v4/topics/';
    var apiPath = apiPathPrefix + '1';

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
            .get(apiPath)
            .expect(403, done);
    });

    it('should return 403 response with invalid jwt token', (done) => {
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer wrong"
            })
            .expect(403, done);
    });
    

    it('should return 404 response if no matching topic', (done) => {
        sandbox.stub(axios, 'get').returnsPromise().resolves({
            data: {
                result: {}
            }
        });
        request(server)
            .get(apiPathPrefix + '10000')
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .expect(404)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it('should return 500 response if error to get user and create discourse user', (done) => {
        sandbox.stub(axios, 'get').returnsPromise().rejects({ response: {
            status: 403
        } });
        sandbox.stub(axios, 'post').returnsPromise().rejects({});
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .expect(500)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it('should return 500 response if error to get user and get topcoder user', (done) => {
        const data ={
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
        stub.returnsPromise().rejects({ response: {
            status: 403
        } });
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .expect(500)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });


    it('should return 200 response with matching topicLookup', (done) => {
        const data ={
            result: {
                status: 200,
                content: 'content'
            }
        };
        sandbox.stub(axios, 'get').returnsPromise().resolves({ data: data });
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .expect(200)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it('should return 500 response if error to get topic', (done) => {
        sandbox.stub(axios, 'get').returnsPromise().rejects({ response: {
            status: 500
        } });
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .expect(500)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it('should return 500 response if forbidden to get topic and error to checkAccessAndProvision', (done) => {
        sandbox.stub(axios, 'get').returnsPromise().rejects({ response: {
            status: 403
        } });
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .expect(500)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it('should return 500 response if forbidden to get topic and succeed to checkAccessAndProvision', (done) => {
        const data ={
            result: {
                status: 200,
                content: 'content'
            }
        };
        var stub = sandbox.stub(axios, 'get');
        const rejected = new Promise((_, r) => r({
            response: {
            status: 403
        } }));
        var url = '/t/1.json?api_key=' + config.get('discourseApiKey') + '&api_username=' + username;
        stub.withArgs(url,sinon.match.any).onFirstCall()
            .returns(rejected);
        stub.withArgs(url,sinon.match.any).onSecondCall()
            .returns(new Promise((s,_) => s({
                data: data
            })));
        stub.returnsPromise().resolves({ data: data });
        sandbox.stub(axios, 'post').returnsPromise().resolves({});
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .expect(500)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            });
    });
});
