/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, getDecodedToken, jwts, prepareDB } from '../../tests';

const axios = require('axios');
const request = require('supertest');
const server = require('../../app');
const db = require('../../models');
const aws = require('aws-sdk');
const sinon = require('sinon');
const config = require('config');

require('should-sinon');

describe('GET /v4/topics/:topicId/posts/:postId/attachments/:attachmentId', () => {
  const apiPath = `/${config.apiVersion}/topics/1/posts/1/attachments/1?referenceId=1`;
  const nonExistingAttachmentPath = `/${config.apiVersion}/topics/1/posts/1/attachments/2?referenceId=1`;
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
    const getSignedUrlStub = sandbox.stub(aws.S3.prototype, 'getSignedUrl');
    getSignedUrlStub.returns('https://s3.com/1/attachment.jpg?signedParam=true');
    prepareDB((err) => {
      if (err) {
        return done(err);
      }
      const auth = getDecodedToken(jwts.member);
      return db.post_attachments.create({
        id: 1,
        postId: 1,
        originalFileName: 'aFileName.jpg',
        fileSize: 123,
        sha1: 'cf444a806626664bc9feee2737158fd312004ce5',
        url: 'https://s3.com/1/12123123-aFileName.jpg',
        createdBy: auth.handle,
        updatedBy: auth.handle,
      }).then(() => done()).catch(done);
    });
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
        Authorization: 'Bearer wrong',
      })
      .expect(403, done);
  });

  it('should return 400 when reference id query parameter is missing', (done) => {
    request(server)
      .get(apiPath.split('?')[0])
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(400)
      .end(done);
  });

  it('should return 403 response when not having access to the project', (done) => {
    stubWithNoAccessToProject();
    request(server)
      .get(apiPath)
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
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

    describe('for a soft deleted existing attachment', () => {
      beforeEach(done => db.post_attachments.update({
        deletedAt: db.sequelize.fn('NOW'), deletedBy: 'deletingUser',
      }, {
        where: { id: 1 },
      }).then(() => done()).catch(done));

      it('should return a not found error', (done) => {
        request(server)
          .get(apiPath)
          .set({
            Authorization: `Bearer ${jwts.member}`,
          })
          .expect(404)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            res.body.should.have.propertyByPath('result', 'content', 'message')
              .eql('Could not find the requested attachment');
            return done();
          });
      });
    });

    describe('for an existing attachment belonging to a different post', () => {
      beforeEach(done => db.post_attachments.update({
        postId: 2,
      }, {
        where: { id: 1 },
      }).then(() => done()).catch(done));

      it('should return a not found error', (done) => {
        request(server)
          .get(apiPath)
          .set({
            Authorization: `Bearer ${jwts.member}`,
          })
          .expect(404)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            res.body.should.have.propertyByPath('result', 'content', 'message')
              .eql('Could not find the requested attachment');
            return done();
          });
      });
    });

    describe('for a non existing attachment', () => {
      it('should return a not found error', (done) => {
        request(server)
          .get(nonExistingAttachmentPath)
          .set({
            Authorization: `Bearer ${jwts.member}`,
          })
          .expect(404)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            res.body.should.have.propertyByPath('result', 'content', 'message')
              .eql('Could not find the requested attachment');
            return done();
          });
      });
    });

    describe('for an existing attachment', () => {
      it('should return a response that redirects to the signed version of the url', (done) => {
        request(server)
          .get(apiPath)
          .set({
            Authorization: `Bearer ${jwts.member}`,
          })
          .expect(302)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            res.headers.location.should.equal('https://s3.com/1/attachment.jpg?signedParam=true');
            return done();
          });
      });
    });
  });
});
