/**
 * Script to migrate from managing topics in Discourse as private messages to managing topics using groups and categories.
 * See https://github.com/appirio-tech/connect-app/issues/1346
 *
 * NOTE. This scripts requires valid TC admin token to access all connect projects.
 *       See constant `TC_ADMIN_TOKEN` in this script.
 *
 * Workflow of this script:
 *  - get all projects in message-service DB
 *  - for each project
 *    - get list of topics from message-service
 *    - get list of project members from TC API v4
 *    - create group with users using Discourse API
 *    - create category with permissions only for the group using Discourse API
 *    - convert topics from private messages to public using Discourse API
 *    - add topics to created category using Discourse API
 *    - Note: users permissions for topics are stayed untouched as they don't make any difference
 */
/* eslint-disable max-len */
const _ = require('lodash');
const Promise = require('bluebird');
const axios = require('axios');
const config = require('config');
const db = require('./models');
const HelperService = require('./services/helper');
const Discourse = require('./services/discourse');
const coreLib = require('tc-core-library-js');
const express = require('express');
const path = require('path');

// we need it to access all the connect projects for migration
const TC_ADMIN_TOKEN = process.env.TC_ADMIN_TOKEN;
// how many attempts to make to migrate a particular project
const MAX_MIGRATE_ATTEMPTS = 10;
// timeout between migrate project attempts in ms
const MIGRATE_ATTEMPT_DELAY = 5000;

let logger;
let helper;
let discourseClient;

let topicMigrationMeanTime = 0;
let projectMigrationMeanTime = 0;
let topicMigratedQty = 0;
let projectMigratedQty = 0;
let nonMigratedTopicsQty = 0;
let nonMigratedProjectsQty = 0;

/**
 * Get member ids of the entity (project)
 *
 * @param {String} referenceLookupEndpoint reference lookup endpoint
 * @param {String} referenceId reference id
 * @return {Promise<Array<String>>} resolves to the list of member ids
 */
function getProjectMembers(referenceLookupEndpoint, referenceId) {
  return axios.get(referenceLookupEndpoint.replace('{id}', referenceId), {
    headers: {
      Authorization: `Bearer ${TC_ADMIN_TOKEN}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  }).then((response) => {
    logger.debug(response.data);
    if (response.data && response.data.result &&
      response.data.result.status === 200 && response.data.result.content) {
      return _.map(response.data.result.content.members, 'userId');
    }
    throw new Error('Cannot get project members');
  });
}

/**
 * Get the list of already migrated projects ids
 *
 * @param {Object} projects map of projectId -> project
 * @return {Array<String>} project ids
 */
function getMigratedProjectIds(projects) {
  const projectIds = _.keys(projects);

  return projectIds.filter((projectId) => {
    const projectTopics = projects[projectId];

    return !_.some(projectTopics, 'isPrivateMessage');
  });
}

/**
 * Get lookup endpoint for reference
 *
 * @param {String} reference reference of the entity
 * @return {Promise} resolves to reference lookup endpoint
 */
function getReferenceLookupEndpoint(reference) {
  return Promise.coroutine(function* a() {
    if (!getReferenceLookupEndpoint.cache[reference]) {
      const referenceLookup = yield db.referenceLookups.findOne({ where: { reference } });
      if (!referenceLookup) {
        throw new Error(`Cannot find reference lookup for '${reference}'.`);
      }
      getReferenceLookupEndpoint.cache[reference] = referenceLookup.endpoint;
    }

    return getReferenceLookupEndpoint.cache[reference];
  })();
}
getReferenceLookupEndpoint.cache = {};

/**
 * Helper method to get the list of errors from Discourse API
 *
 * @param {Object} error error response from Discourse API
 *
 * @return {Array} list of errors
 */
function getDiscourseErrors(error) {
  return _.get(error, 'response.data.errors', []);
}

/* eslint-disable no-param-reassign */
function formatTimeDuration(duration) {
  const oDiff = {};
  let format = '';

  oDiff.days = Math.floor(duration / 1000 / 60 / 60 / 24);
  duration -= oDiff.days * 1000 * 60 * 60 * 24;

  oDiff.hours = Math.floor(duration / 1000 / 60 / 60);
  duration -= oDiff.hours * 1000 * 60 * 60;

  oDiff.minutes = Math.floor(duration / 1000 / 60);
  duration -= oDiff.minutes * 1000 * 60;

  oDiff.seconds = Math.floor(duration / 1000);

  if (oDiff.days > 0) {
    format += `${oDiff.days} days `;
  }

  if (oDiff.hours > 0) {
    format += `${oDiff.hours} hours `;
  }

  if (oDiff.minutes > 0) {
    format += `${oDiff.minutes} minutes `;
  }

  if (oDiff.seconds > 0) {
    format += `${oDiff.seconds} seconds `;
  }

  return format || '0';
}
/* eslint-enable no-param-reassign */

/**
 * Migrate one project
 *
 * @param {String} projectId project id
 * @param {Array} projectTopics project topics
 *
 * @return {Promise} resolves if migration was successful
 */
function migrateProject(projectId, projectTopics) {
  const projectMigrationStartTime = Date.now();
  logger.info(`Migrating project ${projectId}...`);

  return Promise.coroutine(function* b() {
    const projectTopicIds = _.map(projectTopics, 'discourseTopicId');

    logger.debug(`Project topics [${projectTopicIds}]`);

    const projectReference = projectTopics[0].reference;
    const lookupEndpoint = yield getReferenceLookupEndpoint(projectTopics[0].reference);
    let projectMembers = [];
    try {
      projectMembers = yield getProjectMembers(lookupEndpoint, projectId);
    } catch (err) {
      if (_.get(err, 'response.status') === 404) {
        logger.info(`Project ${projectId} wasn't found, so skip migration for this project.`);
        return;
      }
      throw err;
    }
    logger.debug(`Project members [${projectMembers}]`);

    const referenceGroupCategory = yield helper.getEntityGroupAndCategoryOrProvision(
      projectReference,
      projectId,
      projectMembers);

    if (!referenceGroupCategory) {
      throw new Error(`Couldn't create group or category for reference '${projectReference}' of project id ${projectId}.`);
    }

    for (let topicIndex = 0; topicIndex < projectTopicIds.length; topicIndex++) {
      const topicId = projectTopicIds[topicIndex];
      const topicMigrationStartTime = Date.now();
      // make topic public
      try {
        logger.info(`Converting topic ${topicId} to public...`);
        yield discourseClient.convertTopicToPublic(topicId);
      } catch (err) {
        if (_.get(err, 'response.status') === 404) {
          logger.info(`Topic ${topicId} wasn't found, so skip migration for this topic.`);
          return;
        }

        logger.error(`Cannot convert topic ${topicId} to public: ${getDiscourseErrors(err)}`);
        throw err;
      }

      // add topic to category
      try {
        logger.info(`Adding topic ${topicId} to category ${referenceGroupCategory.categoryId}...`);
        yield discourseClient.updateTopic(null, topicId, null, referenceGroupCategory.categoryId);
      } catch (err) {
        logger.error(`Cannot add topic ${topicId} to category ${referenceGroupCategory.categoryId}: ${getDiscourseErrors(err)}`);
        throw err;
      }

      // mark topic as migrated
      try {
        logger.info(`Marking topic ${topicId} as migrated...`);
        const topic = yield db.topics.find({ where: { reference: projectReference, referenceId: projectId, discourseTopicId: topicId } });

        if (!topic) {
          const errText = `Cannot find topic ${topicId} to set that it's migrated.`;
          logger.error(errText);
          throw new Error(errText);
        }

        yield topic.update({
          isPrivateMessage: false,
        });
      } catch (err) {
        logger.error(`Cannot mark topic ${topicId} as migrated.`);
        throw err;
      }

      // calculate topic migration mean time
      const topicMigrationTime = Date.now() - topicMigrationStartTime;
      if (topicMigratedQty > 0) {
        topicMigrationMeanTime = (topicMigrationMeanTime * (topicMigratedQty / (topicMigratedQty + 1)))
          + (topicMigrationTime / (topicMigratedQty + 1));
      } else {
        topicMigrationMeanTime = topicMigrationTime;
      }
      topicMigratedQty += 1;
    }

    // calculate project migration mean time
    const projectMigrationTime = Date.now() - projectMigrationStartTime;
    if (projectMigratedQty > 0) {
      projectMigrationMeanTime = (projectMigrationMeanTime * (projectMigratedQty / (projectMigratedQty + 1)))
        + (projectMigrationTime / (projectMigratedQty + 1));
    } else {
      projectMigrationMeanTime = projectMigrationTime;
    }
    projectMigratedQty += 1;
  })();
}

// run migration
function runMigration() {
  logger.info('Start migration');

  return Promise.coroutine(function* a() {
    try {
      logger.info('Getting all topics from message service DB...');

      logger.info('Estimating projects quantity to migrate...');
      const allTopics = yield db.topics.findAll({
        raw: true,
      });
      const projects = _.groupBy(allTopics, 'referenceId');
      const allProjectIds = _.keys(projects);
      const migratedProjectIds = getMigratedProjectIds(projects);
      nonMigratedTopicsQty = _.filter(allTopics, 'isPrivateMessage').length;
      nonMigratedProjectsQty = allProjectIds.length - migratedProjectIds.length;
      let migratedProjectQty = migratedProjectIds.length;
      logger.info(`Got ${allTopics.length} topics in ${allProjectIds.length} projects from message service DB`);
      logger.info(`Already migrated ${migratedProjectQty} of ${allProjectIds.length} projects`);

      if (migratedProjectQty >= allProjectIds.length) {
        logger.info('No projects to migrate.');
        return;
      }

      // getting projects one by one
      for (let i = 0; ;i++) {
        const unMigratedTopic = yield db.topics.findOne({
          where: { isPrivateMessage: true },
          raw: true,
        });

        if (!unMigratedTopic) {
          logger.info('No more unmigrated topics.');
          break;
        }

        const unMigratedProjectTopics = yield db.topics.findAll({
          where: {
            reference: unMigratedTopic.reference,
            referenceId: unMigratedTopic.referenceId,
            isPrivateMessage: true,
          },
          raw: true,
        });

        // migrate project
        for (let migrateAttempt = 1; migrateAttempt <= MAX_MIGRATE_ATTEMPTS; migrateAttempt++) {
          try {
            yield migrateProject(unMigratedTopic.referenceId, unMigratedProjectTopics);
            break;
          } catch (err) {
            if (migrateAttempt === MAX_MIGRATE_ATTEMPTS) {
              throw err;
            }

            logger.error(err);
            yield Promise.delay(MIGRATE_ATTEMPT_DELAY);
            logger.info(`Perform attempt ${migrateAttempt}`);
          }
        }

        migratedProjectQty += 1;
        const migrationPercentage = ((migratedProjectQty / allProjectIds.length) * 100).toFixed(2);
        logger.info(`Project ${unMigratedTopic.referenceId} is migrated. Total ${migratedProjectQty} from around ${allProjectIds.length} (${migrationPercentage}%)`);
        logger.info(`Project migration mean time ${formatTimeDuration(projectMigrationMeanTime)} (migrated ${projectMigratedQty})`);
        logger.info(`Topic migration mean time ${formatTimeDuration(topicMigrationMeanTime)} (migrated ${topicMigratedQty})`);
        logger.info(`Projects migration estimation time ${formatTimeDuration(projectMigrationMeanTime * (nonMigratedProjectsQty - projectMigratedQty))}`);
        logger.info(`Topics migration estimation time ${formatTimeDuration(topicMigrationMeanTime * (nonMigratedTopicsQty - topicMigratedQty))}`);
      }

      logger.info('Migration successfully finished.');
    } catch (err) {
      logger.error('Migration failed.', err);
    }
  })();
}

if (require.main === module) {
  // for direct run output log to stdout
  logger = coreLib.logger({
    name: 'tc-message-service-migrate-to-groups',
    level: _.get(config, 'logLevel', 'info').toLowerCase(),
    captureLogs: config.get('captureLogs'),
    logentriesToken: _.get(config, 'logentriesToken', null),
  });
  helper = HelperService(logger, db);
  discourseClient = new Discourse(logger);

  runMigration();
} else {
  // if call like a module, output log to file
  const logPath = path.join(__dirname, 'migrate-to-groups.log');

  logger = coreLib.logger({
    name: 'tc-message-service-migrate-to-groups',
    level: _.get(config, 'logLevel', 'info').toLowerCase(),
    captureLogs: config.get('captureLogs'),
    logentriesToken: _.get(config, 'logentriesToken', null),
    streams: [{
      stream: process.stdout,
    }, {
      path: logPath,
    }],
  });
  helper = HelperService(logger, db);
  discourseClient = new Discourse(logger);

  const router = express.Router();

  router.get('/log', function logEndpoint(req, res, next) { // eslint-disable-line prefer-arrow-callback, no-unused-vars
    res.sendFile(logPath);
  });

  router.get('/time', function logEndpoint(req, res, next) { // eslint-disable-line prefer-arrow-callback, no-unused-vars
    res.send([
      `${projectMigratedQty} project migrated. Project migration average time ${formatTimeDuration(projectMigrationMeanTime)}<br>\n`,
      `${topicMigratedQty} topics migrated. Topic migration average time ${formatTimeDuration(topicMigrationMeanTime)}<br>\n`,
      `${nonMigratedProjectsQty - projectMigratedQty} projects to migrate. Estimation time ${formatTimeDuration(projectMigrationMeanTime * (nonMigratedProjectsQty - projectMigratedQty))}<br>\n`,
      `${nonMigratedTopicsQty - topicMigratedQty} topics to migrate. Estimation time ${formatTimeDuration(topicMigrationMeanTime * (nonMigratedTopicsQty - topicMigratedQty))}<br>\n`,
    ].join(''));
  });

  module.exports = {
    runMigration,
    router,
  };
}
