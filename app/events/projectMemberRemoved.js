'use strict'

const _ = require('lodash');
const Promise = require('bluebird');
const db = require('../models');
const Discourse = require('../services/discourse');



module.exports = (logger, msg, channel) => {
  const discourseClient = Discourse(logger);
  const member = JSON.parse(msg.content.toString());

  return Promise.coroutine(function *(){
    let topics;
    try {
      topics = yield db.topics.findAll({
        where: {
          referenceId: member.projectId.toString(),
          reference: 'project'
        },
        attributes: ['discourseTopicId']
      });
    } catch (err) {
      logger.error('Error retrieving project', err, msg);
      return channel.nack(msg, false, !msg.fields.redelivered);
    }

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i].toJSON();
      try {
        yield discourseClient.removeAccess(member.userId.toString(), topic.discourseTopicId);
      } catch (err) {
        logger.error('Error removing access from project project', err, topic.discourseTopicId);
      }
    }
    return channel.ack(msg);
  })();
}
