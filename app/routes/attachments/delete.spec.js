/* eslint-disable no-unused-expressions, newline-per-chained-call */

import { clearDB, getDecodedToken, jwts, prepareDB } from '../../tests';

const axios = require('axios');
const expect = require('chai').expect;
const request = require('supertest');
const server = require('../../app');
const db = require('../../models');
const aws = require('aws-sdk');
const sinon = require('sinon');

require('should-sinon');

describe('DELETE /v4/topics/:topicId/posts/:postId/attachments/:attachmentId', () => {
  const apiPath = '/v4/topics/1/posts/1/attachments/1?referenceId=1';
  const memberUser = {
    handle: getDecodedToken(jwts.member).handle,
    userId: getDecodedToken(jwts.member).userId,
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  const otherMember = {
    handle: getDecodedToken(jwts.otherMember).handle,
    userId: getDecodedToken(jwts.otherMember).userId,
    firstName: 'fname',
    lastName: 'lName',
    email: 'some@abc.com',
  };
  let sandbox;
  let deleteObjectStub;

  const stubWithNoAccessToProject = () => {
    sandbox.stub(axios, 'get').withArgs('http://reftest/1').resolves({
      data: { result: { status: 403, content: {} } },
    });
  };

  const stubWithAccessToProject = () => {
    sandbox.stub(axios, 'get').withArgs('http://reftest/1').resolves({
      data: {
        result: {
          status: 200,
          content: { members: [{ userId: memberUser.userId }, { userId: otherMember.userId }] },
        },
      },
    });
  };

  beforeEach((done) => {
    sandbox = sinon.sandbox.create();
    const s3ServicePrototype = aws.S3.services[Object.keys(aws.S3.services)[0]].prototype;
    deleteObjectStub = sandbox.stub(s3ServicePrototype, 'deleteObject');
    deleteObjectStub.returns({ promise: () => Promise.resolve({}) });
    prepareDB((err) => {
      if (err) {
        return done(err);
      }
      const auth = getDecodedToken(jwts.member);
      return db.postAttachments.create({
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
      .delete(apiPath)
      .expect(403, done);
  });

  it('should return 403 response with invalid jwt token', (done) => {
    request(server)
      .delete(apiPath)
      .set({
        Authorization: 'Bearer wrong',
      })
      .expect(403, done);
  });

  it('should return 400 when reference id query parameter is missing', (done) => {
    request(server)
      .delete(apiPath.split('?')[0])
      .set({
        Authorization: `Bearer ${jwts.member}`,
      })
      .expect(400)
      .end(done);
  });

  it('should return 403 response when not having access to the project', (done) => {
    stubWithNoAccessToProject();
    request(server)
      .delete(apiPath)
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
      beforeEach(done => db.postAttachments.update({
        deletedAt: db.sequelize.fn('NOW'), deletedBy: 'deletingUser',
      }, {
        where: { id: 1 },
      }).then(() => done()).catch(done));

      it('should return a not found error for the non admin author', (done) => {
        request(server)
          .delete(apiPath)
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

      it('should return a not found error for an admin user', (done) => {
        request(server)
          .delete(apiPath)
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

      it('should hard delete the record when an admin user tries to do that', (done) => {
        request(server)
          .delete(`${apiPath}&hardDelete=true`)
          .set({
            Authorization: `Bearer ${jwts.admin}`,
          })
          .expect(200)
          .end(done);
      });
    });

    describe('for an existing attachment belonging to a different post', () => {
      beforeEach(done => db.postAttachments.update({
        postId: 2,
      }, {
        where: { id: 1 },
      }).then(() => done()).catch(done));

      it('should return a not found error', (done) => {
        request(server)
          .delete(apiPath)
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
          .delete('/v4/topics/1/posts/1/attachments/2?referenceId=1')
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
      describe('when a non admin that isn\'t the attachment uploader tries to delete the attachment', () => {
        it('should not be able to do that', (done) => {
          request(server)
            .delete(`${apiPath}`)
            .set({
              Authorization: `Bearer ${jwts.otherMember}`,
            })
            .expect(403)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              res.body.should.have.propertyByPath('result', 'content', 'message')
                .eql('User doesn\'t have delete access to the attachment');
              return done();
            });
        });
      });

      describe('when an admin that isn\'t the attachment uploader tries to delete the attachment', () => {
        it('should be able to do that', (done) => {
          request(server)
            .delete(`${apiPath}`)
            .set({
              Authorization: `Bearer ${jwts.otherAdmin}`,
            })
            .expect(200)
            .end(done);
        });
      });

      it('should return 200 response', (done) => {
        request(server)
          .delete(apiPath)
          .set({
            Authorization: `Bearer ${jwts.member}`,
          })
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            res.body.result.status.should.equal(200);
            return done();
          });
      });

      it('should return a wrapped response with no content attribute', (done) => {
        request(server)
          .delete(apiPath)
          .set({
            Authorization: `Bearer ${jwts.member}`,
          })
          .expect(200)
          .end((err, res) => {
            if (err) {
              return done(err);
            }
            res.body.result.should.not.have.property('content');
            return done();
          });
      });

      it('should soft delete a record in the postAttachments table', (done) => {
        request(server)
          .delete(apiPath)
          .set({
            Authorization: `Bearer ${jwts.member}`,
          })
          .expect(200)
          .end((err) => {
            if (err) {
              return done(err);
            }
            return db.postAttachments.findOne({ where: { id: 1 } })
              .then((postAttachment) => {
                // check the s3 upload mock function to know where this url comes from
                postAttachment.deletedAt.should.exist;
                deleteObjectStub.called.should.be.false;
                done();
              });
          });
      });

      describe('when hard deleting', () => {
        it('should hard delete a record in the postAttachments table when the user is an admin', (done) => {
          request(server)
            .delete(`${apiPath}&hardDelete=true`)
            .set({
              Authorization: `Bearer ${jwts.admin}`,
            })
            .expect(200)
            .end((err) => {
              if (err) {
                return done(err);
              }
              return db.postAttachments.findOne({ where: { id: 1 } })
                .then((postAttachment) => {
                  // check the s3 upload mock function to know where this url comes from
                  expect(postAttachment).to.not.exist;
                  deleteObjectStub.calledOnce.should.be.true;
                  done();
                })
                .catch(done);
            });
        });

        it('should not let a non admin to hard delete an attachment', (done) => {
          request(server)
            .delete(`${apiPath}&hardDelete=true`)
            .set({
              Authorization: `Bearer ${jwts.member}`,
            })
            .expect(403)
            .end((err, res) => {
              if (err) {
                return done(err);
              }
              res.body.should.have.propertyByPath('result', 'content', 'message')
                .eql('User cannot hard delete attachment');
              return done();
            });
        });
      });
    });
  });
});
