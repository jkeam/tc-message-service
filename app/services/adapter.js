'use strict'

var _ = require('lodash');
var Helper = require('./helper.js');
var Promise = require('bluebird');
var config = require('config');

const DISCOURSE_SYSTEM_USERNAME = config.get('discourseSystemUsername')

// storing a reference to handle to userId lookup
// FIXME: (parth) this map will grow eventually as more users are added,
// consider using external cache instead
const handleMap = { system: 'system' };
handleMap[DISCOURSE_SYSTEM_USERNAME] = DISCOURSE_SYSTEM_USERNAME

function Adapter(logger, db) {
  var helper = Helper(logger);

  this.userIdLookup = function userIdLookup(handle) {

    return new Promise((resolve, reject) => {
      if (handleMap[handle]) {
        resolve(handleMap[handle]);
      } else {
        return helper.getTopcoderUser(handle).then(result => {
          if (result && result.userId) {
            handleMap[handle] = result.userId
            resolve(result.userId);
          } else {
            resolve(null);
          }
        }).catch(() =>
      resolve(null));
      }
    });
  }

  function convertPost(input) {
    var userId = input.username
    userId = userId !== 'system' ? parseInt(userId) : userId
    return helper.mentionUserIdToHandle(input.cooked)
      .then((postBody) => {
        return {
          id: input.id,
          date: input.created_at,
          userId,
          read: true,
          body: postBody,
          type: 'post'
        }
      });
  }

  this.adaptPosts = function(input) {
    var result = [];

    return Promise.each(input.post_stream.posts, (post) => {
      return convertPost(post).then((cpost) => result.push(cpost))
    }).then(() => {
      return result;
    });
  }

  this.adaptPost = function(input) {
    return convertPost(input);
  }

  this.adaptTopics = function(input) {
    var topics = [];
    var discourseTopics = input;
    if (!(discourseTopics instanceof Array)) {
      discourseTopics = [discourseTopics];
    }

    return Promise.each(discourseTopics, discourseTopic => {
      var userId = discourseTopic.post_stream.posts[0].username;
      userId = userId !== 'system' ? parseInt(userId) : userId
      logger.debug('DT', discourseTopic.title)
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
        }).then(result => {
        // logger.debug('result', result)
        if (result.discourseTopic.post_stream && result.discourseTopic.post_stream.posts) {
          return Promise.each(result.discourseTopic.post_stream.posts, discoursePost => {
            return helper.mentionUserIdToHandle(discoursePost.cooked)
              .then((postBody) => {
                var userId = discoursePost.username;
                userId = userId !== 'system' ? parseInt(userId) : userId
                // ignore createdAt for invited_user type posts
                if (discoursePost.action_code !== 'invited_user' && discoursePost.created_at > result.topic.lastActivityAt) {
                  result.topic.lastActivityAt = discoursePost.created_at;
                }
                if (discoursePost.action_code == 'invited_user' && discoursePost.action_code_who) {
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
                    body: postBody,
                    type: 'post'
                  });
                }
              })
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
