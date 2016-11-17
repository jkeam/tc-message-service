'use strict'

var _ = require('lodash');
var Helper = require('./helper.js');
var Promise = require('bluebird');
var config = require('config');

const DISCOURSE_SYSTEM_USERNAME = config.get('discourseSystemUsername')

function Adapter(clsLogger, db) {
    var helper = Helper(clsLogger);
    var handleMap = {
        system: 'system',
    };
    handleMap[DISCOURSE_SYSTEM_USERNAME] = 'system'

    function userIdLookup(handle, logger) {
      var logger = logger || clsLogger
      // FIXME: (parth) this map will grow eventually as more users are added,
      // consider using external cache instead
      return new Promise((resolve, reject) => {
        if (handleMap[handle]) {
          resolve(handleMap[handle]);
        } else {
            return helper.getTopcoderUser(logger, handle).then(result => {
              if (result && result.userId) {
                handleMap[handle] = result.userId
                resolve(result.userId);
              } else {
                resolve(null);
              }
            });
          }
      });
    }

    function convertPost(userId, input) {
        return {
            id: input.id,
            date: input.created_at,
            userId: userId,
            read: true,
            body: input.cooked,
            type: 'post'
        }
    }

    this.adaptPosts = function(input, logger) {
        var logger = logger || clsLogger
        var handle = input.username;
        var result = [];

        return Promise.each(input.post_stream.posts, (post) => {
            return userIdLookup(post.username, logger).then(userId => {
                result.push(convertPost(userId, post));

                return result;
            });
        }).then(() => {
            return result;
        });
    }

    this.adaptPost = function(input, logger) {
        var handle = input.username;

        return userIdLookup(logger, handle).then(userId => {
            return convertPost(userId, input);
        });
    }

    this.adaptTopics = function(input, logger) {
        var logger = logger || clsLogger
        var topics = [];
        var discourseTopics = input;
        if(!(discourseTopics instanceof Array)) {
            discourseTopics = [discourseTopics];
        }

        return Promise.each(discourseTopics, discourseTopic => {
            var handle = discourseTopic.post_stream.posts[0].username;
            logger.debug('DT', discourseTopic.title)
            return userIdLookup(handle, logger).then((userId) => {
              logger.debug('found userId', handle, userId)
                return db.topics.find({
                    where: {
                        discourseTopicId: discourseTopic.id
                    }
                }).then(pgTopic => {
                    var topic = {
                        id: discourseTopic.id,
                        dbId: pgTopic ? pgTopic.id : undefined,
                        reference: pgTopic ? pgTopic.reference : undefined,
                        referenceId: pgTopic ? pgTopic.referenceId : undefined,
                        date: discourseTopic.created_at,
                        lastActivityAt: discourseTopic.created_at,
                        title: discourseTopic.title,
                        read: discourseTopic.post_stream.posts[0].read,
                        userId: userId,
                        tag: discourseTopic.tag,
                        totalPosts: discourseTopic.post_stream.stream.length,
                        retrievedPosts: discourseTopic.post_stream.posts.length,
                        postIds: discourseTopic.post_stream.stream,
                        posts: []
                    };

                    return {
                        discourseTopic: discourseTopic,
                        topic: topic
                    };
                })
                .catch((err) => {
                  logger.debug('Topic not found', discourseTopic.id, err)
                })
            }).then(result => {
              // logger.debug('result', result)
                if(result.discourseTopic.post_stream && result.discourseTopic.post_stream.posts) {
                    return Promise.each(result.discourseTopic.post_stream.posts, discoursePost => {
                        var postHandle = discoursePost.username;

                        return userIdLookup(postHandle, logger).then(userId => {
                            if(discoursePost.created_at > result.topic.lastActivityAt) {
                                result.topic.lastActivityAt = discoursePost.created_at;
                            }
                            if(discoursePost.action_code == 'invited_user' && discoursePost.action_code_who) {
                                result.topic.retrievedPosts--;
                                result.topic.posts.push({
                                    id: discoursePost.id,
                                    date: discoursePost.created_at,
                                    userId: userId,
                                    read: true,
                                    body: discoursePost.action_code_who + ' joined the discussion',
                                    type: 'user-joined'
                                });
                            } else {
                                result.topic.posts.push({
                                    id: discoursePost.id,
                                    date: discoursePost.created_at,
                                    userId: userId,
                                    read: discoursePost.read,
                                    body: discoursePost.cooked,
                                    type: 'post'
                                });
                            }
                        });
                    }).then(() => {
                        return result;
                    });
                } else {
                    return result;
                }
            }).then(result => {
                topics.push(result.topic);
                return topics;
            });
        }).then(() => {
            return topics;
        });
    }

    return this;
}

module.exports = Adapter;
