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
        .then(()=> models.topics.create({
            id:2,
            reference: 'notexist',
            referenceId: 'referenceId',
            discourseTopicId: 2,
            tag:'tag'
        }))
        .then(()=> models.referenceLookups.create({
            reference: 'reference',
            endpoint:'endpoint{id}'
        }))
        .then(() => done())
}
describe('GET /v4/topics ', () => {
    var apiPath = '/v4/topics';
    var testQuery = {
        filter: 'tag=tag&reference=reference&referenceId=referenceId'
    };
    var testQuery2 = {
        filter: 'tag=notexist&reference=notexist&referenceId=notexist'
    };
    var testQuery3 = {
        filter: 'tag=tag&reference=notexist&referenceId=referenceId'
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

    it('should return 400 response without filter', (done) => {
        request(server)
            .get(apiPath)
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

    it('should return 400 response without reference filter', (done) => {
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .query({
                filter: 'referenceId=1'
            })
            .expect(400)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it('should return 400 response without referenceId filter', (done) => {
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .query({
                filter: 'reference=1'
            })
            .expect(400)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it('should return 500 response with invalid filter', (done) => {
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .query({
                filter: 'reference=reference&referenceId=referenceId&wrong=1'
            })
            .expect(500)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                console.log(res.body);
                done()
            })
    });

    it('should return 404 response if no matching topics', (done) => {
        sandbox.stub(axios, 'get').returnsPromise().resolves({
            data: {
                result: {}
            }
        });
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .query(testQuery2)
            .expect(404)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it('should return 404 response if error to get user and create discourse user', (done) => {
        sandbox.stub(axios, 'get').returnsPromise().rejects({ response: {
            status: 403
        } });
        sandbox.stub(axios, 'post').returnsPromise().rejects({});
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .query({
                filter: 'tag=notexist&reference=reference&referenceId=referenceId'
            })
            .expect(404)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it('should return 404 response if error to get user and get topcoder user', (done) => {
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
            .query({
                filter: 'tag=notexist&reference=reference&referenceId=referenceId'
            })
            .expect(404)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it('should return 404 response if error to get user and failed to create discourse user', (done) => {
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
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .query({
                filter: 'tag=notexist&reference=reference&referenceId=referenceId'
            })
            .expect(404)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it('should return 404 response if error to get user and succeed to create discourse user', (done) => {
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
            .returnsPromise().resolves({
            data: data
        });
        stub.returnsPromise().resolves({
            data: data
        });
        sandbox.stub(axios, 'post').returnsPromise().resolves({
            data: {
                success: true
            }
        });
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .query({
                filter: 'tag=notexist&reference=reference&referenceId=referenceId'
            })
            .expect(404)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it.skip('should return 200 response with no matching referenceLookup', (done) => {
        const data = {
            topic_id: 2
        };
        sandbox.stub(axios, 'get').returnsPromise().resolves({ status: 200, data : data});
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .query(testQuery3)
            .expect(200)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                res.body.should.have.propertyByPath('result', 'content', 0, 'topic_id').eql(data.topic_id);
                done()
            })
    });

    it('should return 404 response if error to grantAccess to post with reject', (done) => {
        sandbox.stub(axios, 'get').returnsPromise().resolves({});
        sandbox.stub(axios, 'post').returnsPromise().rejects({});
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .query(testQuery2)
            .expect(404)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });



    it('should return 404 response if error to grantAccess to post with invalid status', (done) => {
        sandbox.stub(axios, 'get').returnsPromise().resolves({});
        sandbox.stub(axios, 'post').returnsPromise().resolves({ status: 500});
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .query(testQuery2)
            .expect(404)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it.skip('should return 200 response with matching topicLookup', (done) => {
        const data = {
            post_stream: {
                posts: [{
                    id: 1
                }]
            }
        };
        var get = sandbox.stub(axios, 'get').returnsPromise().resolves({ data: data });
        var post = sandbox.stub(axios, 'post')
                       .withArgs(sinon.match(/^\/topics\/timings\.json/), sinon.match.any, sinon.match.any)
                       .returnsPromise().resolves({ data: data });
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .query(testQuery)
            .expect(200)
            .end(function(err, res) {
                if (err) {
                    return done(err);
                }
                // Wait a second as this endpoint will be called asynchronously,
                // which may be after the HTTP request above has returned.
                setTimeout(function() {
                    sinon.assert.called(post);
                    done();
                }, 1000);
            });
    });

    it.skip('should return 404 response if error to get topic', (done) => {
        sandbox.stub(axios, 'get').returnsPromise().rejects({ response: {
            status: 500
        } });
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .query(testQuery)
            .expect(404)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it.skip('should return 403 response if forbidden to get topic and error to checkAccessAndProvision', (done) => {
        sandbox.stub(axios, 'get').returnsPromise().rejects({ response: {
            status: 403
        } });
        request(server)
            .get(apiPath)
            .set({
                'Authorization': "Bearer " + jwts.admin
            })
            .query(testQuery)
            .expect(403)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            })
    });

    it.skip('should return 200 response if forbidden to get topic and succeed to checkAccessAndProvision', (done) => {
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
            .query(testQuery)
            .expect(200)
            .end(function(err, res) {
                if (err) {
                    return done(err)
                }
                done()
            });
    });
});
