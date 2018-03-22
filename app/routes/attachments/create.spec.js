/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, jwts, prepareDB, getDecodedToken } from '../../tests';

const axios = require('axios');
const request = require('supertest');
const server = require('../../app');
const db = require('../../models');
const aws = require('aws-sdk');
const s3UploadMock = require('./create.s3.upload.mock');
const sinon = require('sinon');
const config = require('config');

require('should-sinon');

describe('POST /v4/topics/:topicId/posts/:postId/attachments', () => {
  const apiPath = `/${config.apiVersion}/topics/1/posts/1/attachments?referenceId=1`;
  const memberUser = {
    handle: getDecodedToken(jwts.member).handle,
    userId: getDecodedToken(jwts.member).userId,
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  let sandbox;

  const stubWithNoAccessToProject = () => {
    sandbox.stub(axios, 'get').withArgs('http://reftest/1').resolves({
      data: { result: { status: 403, content: {} } },
    });
  };

  const stubWithAccessToProject = () => {
    sandbox.stub(axios, 'get').withArgs('http://reftest/1').resolves({
      data: { result: { status: 200, content: { members: [{ userId: memberUser.userId }] } } },
    });
  };

  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    const uploadStub = sandbox.stub(aws.S3.prototype, 'upload');
    uploadStub.callsFake(s3UploadMock);
    prepareDB(done);
  });

  afterEach((done) => {
    sandbox.restore();
    clearDB(done);
  });

  it('should return 403 response without a jwt token', (done) => {
    request(server)
      .post(apiPath)
      .attach('file', 'app/tests/test.png')
      .expect(403, done);
  });

  it('should return 403 response with invalid jwt token', (done) => {
    request(server)
      .post(apiPath)
      .set({
        Authorization: 'Bearer wrong',
      })
      .attach('file', 'app/tests/test.png')
      .expect(403, done);
  });

  it('should return 400 when reference id query parameter is missing', (done) => {
    request(server)
      .post(apiPath.split('?')[0])
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .attach('file', 'app/tests/test.png')
      .expect(400)
      .end(done);
  });

  it('should return 400 response when missing file', (done) => {
    stubWithAccessToProject();
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .expect(400)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Missing file');
        return done();
      });
  });

  it('should return 400 response when uploading non-image file', (done) => {
    stubWithAccessToProject();
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.admin}`,
      })
      .attach('file', 'app/tests/post.json')
      .expect(400)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('Can only upload image file');
        return done();
      });
  });

  it('should return 403 response when not having access to the project', (done) => {
    stubWithNoAccessToProject();
    request(server)
      .post(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .attach('file', 'app/tests/test.png')
      .expect(403)
      .end((err, res) => {
        if (err) {
          return done(err);
        }
        res.body.should.have.propertyByPath('result', 'content', 'message')
          .eql('User doesn\'t have access to the project');
        return done();
      });
  });

  describe('with valid jwt token and payload', () => {
    beforeEach(() => {
      stubWithAccessToProject();
    });

    it('should return 200 response', (done) => {
      request(server)
        .post(apiPath)
        .set({
          Authorization: `Bearer ${jwts.admin}`,
        })
        .attach('file', 'app/tests/test.png')
        .expect(200)
        .end(done);
    });

    it('should return the correct sha1 checksum', (done) => {
      request(server)
        .post(apiPath)
        .set({
          Authorization: `Bearer ${jwts.admin}`,
        })
        .attach('file', 'app/tests/test.png')
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          res.body.result.content.sha1.should.equal('cf444a806626664bc9feee2737158fd312004ce5');
          return done();
        });
    });

    it('should return no url attribute', (done) => {
      request(server)
        .post(apiPath)
        .set({
          Authorization: `Bearer ${jwts.admin}`,
        })
        .attach('file', 'app/tests/test.png')
        .expect(200)
        .end((err, res) => {
          if (err) {
            return done(err);
          }
          res.body.result.content.should.not.have.property('url');
          return done();
        });
    });

    it('should create a record in the post_attachments table with the correct url', (done) => {
      request(server)
        .post(apiPath)
        .set({
          Authorization: `Bearer ${jwts.admin}`,
        })
        .attach('file', 'app/tests/test.png')
        .expect(200)
        .end((err) => {
          if (err) {
            return done(err);
          }
          // we start from an empty database, so having a non null result from this means that it works correctly
          return db.post_attachments.findOne()
            .then((postAttachment) => {
              // check the s3 upload mock function to know where this url comes from
              postAttachment.url.should.equal('mock-location');
              done();
            });
        });
    });
  });
});
