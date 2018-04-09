const models = require('../models');
const jwt = require('jsonwebtoken');
const Promise = require('bluebird');


const jwts = {
  // userId = 40051331
  // eslint-disable-next-line
  member: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJUb3Bjb2RlciBVc2VyIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJ0ZXN0MSIsImV4cCI6MjU2MzA3NjY4OSwidXNlcklkIjoiNDAwNTEzMzEiLCJpYXQiOjE0NjMwNzYwODksImVtYWlsIjoidGVzdEB0b3Bjb2Rlci5jb20iLCJqdGkiOiJiMzNiNzdjZC1iNTJlLTQwZmUtODM3ZS1iZWI4ZTBhZTZhNGEifQ.pDtRzcGQjgCBD6aLsW-1OFhzmrv5mXhb8YLDWbGAnKo',
  // eslint-disable-next-line
  otherMember: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJUb3Bjb2RlciBVc2VyIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJvdGhlclVzZXIiLCJleHAiOjI1NjMwNzY2ODksInVzZXJJZCI6IjQwMDUxMzcxIiwiaWF0IjoxNDYzMDc2MDg5LCJlbWFpbCI6Im90aGVyX3VzZXJAdG9wY29kZXIuY29tIiwianRpIjoiYzMzYjc3Y2QtYjUyZS00MGZlLTgzN2UtYmViOGUwYWU2YTRhIn0.tqCteP3BWtWWhilsON0E6jaLx8hL_snJUHcy9MAn5FQ',
  // userId = 40051333
  // eslint-disable-next-line
  admin: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJ0ZXN0MSIsImV4cCI6MjU2MzA3NjY4OSwidXNlcklkIjoiNDAwNTEzMzMiLCJpYXQiOjE0NjMwNzYwODksImVtYWlsIjoidGVzdEB0b3Bjb2Rlci5jb20iLCJqdGkiOiJiMzNiNzdjZC1iNTJlLTQwZmUtODM3ZS1iZWI4ZTBhZTZhNGEifQ.2RqIjs8KYGUZNEaNYF8b4FOPLyUwW1bV_HTEFSOCzQ0',
  // eslint-disable-next-line
  otherAdmin: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJ0ZXN0MiIsImV4cCI6MjU2MzA3NjY4OSwidXNlcklkIjoiNDAwNTEzMzkiLCJpYXQiOjE0NjMwNzYwODksImVtYWlsIjoidGVzdDJAdG9wY29kZXIuY29tIiwianRpIjoiYjMzYjc3Y2QtYjUyZS00MGZlLTgzN2UtYmViOGUwYWU2YTRhIn0.QfjhFB34i6QN3Fgd4vLc0iO_Ff7GhuaifK2nraI8Ers',
  // userId = 40051334
  // eslint-disable-next-line
  manager: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJDb25uZWN0IE1hbmFnZXIiXSwiaXNzIjoiaHR0cHM6Ly9hcGkudG9wY29kZXItZGV2LmNvbSIsImhhbmRsZSI6InRlc3QxIiwiZXhwIjoyNTYzMDc2Njg5LCJ1c2VySWQiOiI0MDA1MTMzNCIsImlhdCI6MTQ2MzA3NjA4OSwiZW1haWwiOiJ0ZXN0QHRvcGNvZGVyLmNvbSIsImp0aSI6ImIzM2I3N2NkLWI1MmUtNDBmZS04MzdlLWJlYjhlMGFlNmE0YSJ9.YTYWbA5JmjdC_dVA1kQjcWtpKIeWs7FwDa8B-xsnhN0',
};

function getDecodedToken(token) {
  return jwt.decode(token);
}

function clearDBPromise() {
  return models.sequelize.sync()
    .then(() => models.topics.truncate({
      cascade: true,
      logging: false,
    }))
    .then(() => models.posts.truncate({
      cascade: true,
      logging: false,
    }))
    .then(() => models.post_user_stats.truncate({
      cascade: true,
      logging: false,
    }))
    .then(() => models.post_attachments.truncate({
      cascade: true,
      logging: false,
    }))
    .then(() => models.reference_lookups.truncate({
      cascade: true,
      logging: false,
    }));
}

function clearDB(done) {
  return clearDBPromise()
    .then(() => done());
}

function prepareDB(done) {
  return clearDBPromise()
    .then(() => {
      const promises = [
        models.sequelize.query('ALTER SEQUENCE topics_id_seq RESTART WITH 1;'),
        models.sequelize.query('ALTER SEQUENCE posts_id_seq RESTART WITH 1;'),
        models.topics.create({
          // id: 1,
          reference: 'project',
          referenceId: 'referenceId',
          discourseTopicId: 1,
          tag: 'tag',
          title: 'Mock topic title',
          createdBy: '123456789',
        }),
        models.reference_lookups.create({
          id: 1,
          reference: 'project',
          endpoint: 'http://reftest/{id}', // eslint-disable-line
        }),
      ];
      return Promise.all(promises).then((responses) => {
        if (responses && responses.length > 1) {
          const topic = responses[2];
          const topicId = topic.id;
          // console.log(responses[2], 'topicId');
          return Promise.mapSeries([
            models.posts.create({
              raw: 'Mock topic body',
              topicId,
              createdBy: '123456789',
              postNumber: 1,
            }),
            models.posts.create({
              raw: 'Mock topic post - logically first post',
              topicId,
              createdBy: '123456789',
              postNumber: 2,
            }),
          ], t => t)
          .then(posts => ({ topic, posts }));
        }
        return responses;
      });
    })
    .then((responses) => {
      if (done && typeof done === 'function') {
        done();
      }
      return responses;
    });
}

function findLast(model) {
  return new Promise((resolve, reject) => {
    model.findAll({
      limit: 1,
      order: [['createdAt', 'DESC']],
    }).then((entries) => {
      resolve(entries[0]);
    }).catch((e) => {
      reject(e);
    });
  });
}

module.exports = {
  prepareDB,
  clearDB,
  jwts,
  getDecodedToken,
  findLast,
};
