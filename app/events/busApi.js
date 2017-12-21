// import _ from 'lodash';
import 'config';
import { EVENT, BUS_API_EVENT } from '../constants';
import { createEvent } from '../services/busApi';

module.exports = (app, db, logger) => {
  app.on(EVENT.TOPIC_CREATED, ({ req, topic }) => {
    logger.debug('receive TOPIC_CREATED event');

    if (topic.reference.toLowerCase() === 'project') {
      createEvent(BUS_API_EVENT.TOPIC_CREATED, {
        topicId: topic.discourseTopicId,
        topicTitle: req.body.title,
        userId: req.authUser.userId,
        projectId: topic.referenceId,
      });
    }
  });

  app.on(EVENT.TOPIC_DELETED, ({ req, topic }) => {
    if (topic && topic.reference.toLowerCase() === 'project') {
      createEvent(BUS_API_EVENT.TOPIC_DELETED, {
        topicId: req.params.topicId,
        userId: req.authUser.userId,
        projectId: topic.referenceId,
      });
    }
  });

  app.on(EVENT.POST_CREATED, ({ req, post }) => {
    db.topics.findOne({ where: { discourseTopicId: req.params.topicId } })
    .then((topic) => {
      if (topic && topic.reference.toLowerCase() === 'project') {
        createEvent(BUS_API_EVENT.POST_CREATED, {
          topicId: req.params.topicId,
          postId: post.id,
          postContent: post.body,
          userId: req.authUser.userId,
          projectId: topic.referenceId,
        });
      }
    });
  });

  app.on(EVENT.POST_DELETED, ({ req }) => {
    db.topics.findOne({ where: { discourseTopicId: req.params.topicId } })
    .then((topic) => {
      if (topic && topic.reference.toLowerCase() === 'project') {
        createEvent(BUS_API_EVENT.POST_DELETED, {
          topicId: req.params.topicId,
          postId: req.params.postId,
          userId: req.authUser.userId,
          projectId: topic.referenceId,
        });
      }
    });
  });

  app.on(EVENT.POST_UPDATED, ({ req, post }) => {
    db.topics.findOne({ where: { discourseTopicId: req.params.topicId } })
    .then((topic) => {
      logger.debug('haha', topic);
      if (topic && topic.reference.toLowerCase() === 'project') {
        createEvent(BUS_API_EVENT.POST_UPDATED, {
          topicId: req.params.topicId,
          postId: post.id,
          userId: req.authUser.userId,
          projectId: topic.referenceId,
        });
      }
    });
  });
};
