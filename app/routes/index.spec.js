'use strict'
process.env.NODE_ENV = 'test';
require('should');
var request = require('supertest');
var server = require('../../server');
describe('index', () => {
    it('GET /_health should return 200 response', (done) => {
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