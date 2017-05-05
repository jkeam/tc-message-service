const models = require('../models');


const jwts = {
  // userId = 40051331
  // eslint-disable-next-line
  member: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJUb3Bjb2RlciBVc2VyIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJ0ZXN0MSIsImV4cCI6MjU2MzA3NjY4OSwidXNlcklkIjoiNDAwNTEzMzEiLCJpYXQiOjE0NjMwNzYwODksImVtYWlsIjoidGVzdEB0b3Bjb2Rlci5jb20iLCJqdGkiOiJiMzNiNzdjZC1iNTJlLTQwZmUtODM3ZS1iZWI4ZTBhZTZhNGEifQ.pDtRzcGQjgCBD6aLsW-1OFhzmrv5mXhb8YLDWbGAnKo',
  // userId = 40051333
  // eslint-disable-next-line
  admin: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJ0ZXN0MSIsImV4cCI6MjU2MzA3NjY4OSwidXNlcklkIjoiNDAwNTEzMzMiLCJpYXQiOjE0NjMwNzYwODksImVtYWlsIjoidGVzdEB0b3Bjb2Rlci5jb20iLCJqdGkiOiJiMzNiNzdjZC1iNTJlLTQwZmUtODM3ZS1iZWI4ZTBhZTZhNGEifQ.2RqIjs8KYGUZNEaNYF8b4FOPLyUwW1bV_HTEFSOCzQ0',
  // userId = 40051334
  // eslint-disable-next-line
  manager: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJDb25uZWN0IE1hbmFnZXIiXSwiaXNzIjoiaHR0cHM6Ly9hcGkudG9wY29kZXItZGV2LmNvbSIsImhhbmRsZSI6InRlc3QxIiwiZXhwIjoyNTYzMDc2Njg5LCJ1c2VySWQiOiI0MDA1MTMzNCIsImlhdCI6MTQ2MzA3NjA4OSwiZW1haWwiOiJ0ZXN0QHRvcGNvZGVyLmNvbSIsImp0aSI6ImIzM2I3N2NkLWI1MmUtNDBmZS04MzdlLWJlYjhlMGFlNmE0YSJ9.YTYWbA5JmjdC_dVA1kQjcWtpKIeWs7FwDa8B-xsnhN0',
};

function clearDBPromise() {
  return models.sequelize.sync()
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
          id: 1,
          reference: 'reference',
          referenceId: 'referenceId',
          discourseTopicId: 1,
          tag: 'tag',
        }),
        models.referenceLookups.create({
          id: 1,
          reference: 'reference',
          endpoint: 'http://reftest/${id}', // eslint-disable-line
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
};
