import Promise from 'bluebird';
import _ from 'lodash';
import Discourse from '../services/discourse';
import HelperService from '../services/helper';
import db from '../models';

// const Promise = require('bluebird');
// const Discourse = require('../services/discourse');


module.exports = (logger, msg, channel) => {
  const discourseClient = Discourse(logger);
  const util = new HelperService(logger, db, discourseClient);
  const member = JSON.parse(msg.content.toString());
  const projectId = member.projectId.toString();

  return Promise.coroutine(function* a() {
    const userId = member.userId.toString();
    try {
      // check if user exists or create user in discourse
      yield util.getUserOrProvision(userId);
      // now fetch all topics from db
      const topics = yield db.topics.findAll({
        where: {
          referenceId: projectId,
          reference: 'project',
        },
        attributes: ['discourseTopicId'],
        raw: true,
      });

      const topicPromises = _.map(topics, t => discourseClient.grantAccess(userId, t.discourseTopicId));
      return Promise.all(topicPromises)
        .then(() => {
          logger.info(`Added user ${userId} to all topics for project ${projectId}`);
          return channel.ack(msg);
        });
    } catch (error) {
      logger.debug(error.response && error.response.status);
      logger.debug(error.response && error.response.data);
      return channel.nack(msg, false, !msg.fields.redelivered);
    }
  })();
};
