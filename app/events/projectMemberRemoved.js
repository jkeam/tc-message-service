import Promise from 'bluebird';
import _ from 'lodash';
import db from '../models';
import Discourse from '../services/discourse';


module.exports = (logger, msg, channel) => {
  const discourseClient = new Discourse(logger);
  const member = JSON.parse(msg.content.toString());
  const userId = member.userId.toString();
  const projectId = member.projectId.toString();

  return Promise.coroutine(function* () {
    let topics;
    try {
      topics = yield db.topics.findAll({
        where: {
          referenceId: member.projectId.toString(),
          reference: 'project',
        },
        attributes: ['discourseTopicId'],
        raw: true,
      });
      const topicPromises = _.map(topics, t => discourseClient.removeAccess(userId, t.discourseTopicId));
      return Promise.all(topicPromises)
        .then(() => {
          logger.info(`Removed user ${userId} from all topics for project ${projectId}`);
          return channel.ack(msg);
        })
        .catch((error) => {
          logger.debug(error.response && error.response.status);
          logger.debug(error.response && error.response.data);
          return channel.nack(msg, false, !msg.fields.redelivered);
        });
    } catch (error) {
      logger.debug(error.response && error.response.status);
      logger.debug(error.response && error.response.data);
      return channel.nack(msg, false, !msg.fields.redelivered);
    }
  })();
};
