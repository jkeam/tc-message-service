const models = require('../models');
const jwt = require('jsonwebtoken');


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
    .then(() => models.postAttachments.truncate({
      cascade: true,
      logging: false,
    }))
    .then(() => models.topics.truncate({
      cascade: true,
      logging: false,
    }))
    .then(() => models.referenceLookups.truncate({
      cascade: true,
      logging: false,
    }));
}

function clearDB(done) {
  clearDBPromise()
    .then(() => done());
}

function prepareDB(done) {
  clearDBPromise()
    .then(() => {
      const promises = [
        models.topics.create({
          // id: 1,
          reference: 'project',
          referenceId: 'referenceId',
          discourseTopicId: 1,
          tag: 'tag',
        }),
        models.referenceLookups.create({
          id: 1,
          reference: 'project',
          endpoint: 'http://reftest/{id}', // eslint-disable-line
        }),
      ];
      return Promise.all(promises);
    })
    .then(() => done());
}

module.exports = {
  prepareDB,
  clearDB,
  jwts,
  getDecodedToken,
};
