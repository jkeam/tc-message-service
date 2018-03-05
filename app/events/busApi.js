// import _ from 'lodash';
import 'config';
import { EVENT, BUS_API_EVENT } from '../constants';
import { createEvent } from '../services/busApi';

module.exports = (app, db, logger) => {
  app.on(EVENT.TOPIC_CREATED, ({ req, topic }) => {
    logger.debug('receive TOPIC_CREATED event');

    if (topic.reference.toLowerCase() === 'project') {
      createEvent(BUS_API_EVENT.TOPIC_CREATED, {
        topicId: topic.id,
        topicTitle: topic.title,
        userId: req.authUser.userId,
        projectId: topic.referenceId,
        initiatorUserId: req.authUser.userId,
      }, logger);
    }
  });

  app.on(EVENT.TOPIC_DELETED, ({ req, topic }) => {
    if (topic && topic.reference.toLowerCase() === 'project') {
      createEvent(BUS_API_EVENT.TOPIC_DELETED, {
        topicId: topic.id,
        userId: req.authUser.userId,
        projectId: topic.referenceId,
        initiatorUserId: req.authUser.userId,
      }, logger);
    }
  });

  app.on(EVENT.POST_CREATED, ({ req, post, topic }) => {
    if (topic && topic.reference.toLowerCase() === 'project') {
      createEvent(BUS_API_EVENT.POST_CREATED, {
        topicId: post.topicId,
        postId: post.id,
        postContent: post.raw,
        userId: req.authUser.userId,
        projectId: topic.referenceId,
        initiatorUserId: req.authUser.userId,
      }, logger);
    }
  });

  app.on(EVENT.POST_DELETED, ({ req, topic }) => {
    if (topic && topic.reference.toLowerCase() === 'project') {
      createEvent(BUS_API_EVENT.POST_DELETED, {
        topicId: topic.id,
        postId: req.params.postId,
        userId: req.authUser.userId,
        projectId: topic.referenceId,
        initiatorUserId: req.authUser.userId,
      }, logger);
    }
  });

  app.on(EVENT.POST_UPDATED, ({ req, post, topic }) => {
    if (topic && topic.reference.toLowerCase() === 'project') {
      createEvent(BUS_API_EVENT.POST_UPDATED, {
        topicId: topic.id,
        postId: post.id,
        userId: req.authUser.userId,
        projectId: topic.referenceId,
        initiatorUserId: req.authUser.userId,
      }, logger);
    }
  });
};
