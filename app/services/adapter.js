

const Helper = require('./helper.js');
const Promise = require('bluebird');
const config = require('config');

const DISCOURSE_SYSTEM_USERNAME = config.get('discourseSystemUsername');

// storing a reference to handle to userId lookup
// FIXME: (parth) this map will grow eventually as more users are added,
// consider using external cache instead
const handleMap = { system: 'system' };
handleMap[DISCOURSE_SYSTEM_USERNAME] = DISCOURSE_SYSTEM_USERNAME;

function Adapter(logger, db) {
  const helper = Helper(logger);

  this.userIdLookup = function userIdLookup(handle) {
    return new Promise((resolve, reject) => { // eslint-disable-line
      if (handleMap[handle]) {
        resolve(handleMap[handle]);
      } else {
        return helper.getTopcoderUser(handle).then((result) => {
          if (result && result.userId) {
            handleMap[handle] = result.userId;
            resolve(result.userId);
          } else {
            resolve(null);
          }
        }).catch(() =>
      resolve(null));
      }
    });
  };

  function convertPost(input) {
    let userId = input.username;
    userId = userId !== 'system' && userId !== DISCOURSE_SYSTEM_USERNAME ? parseInt(userId, 10) : userId;
    return helper.mentionUserIdToHandle(input.cooked)
      .then(postBody => ({
        id: input.id,
        date: input.created_at,
        userId,
        read: true,
        body: postBody,
        type: 'post',
      }));
  }

  this.adaptPosts = function a(input) {
    const result = [];

    return Promise.each(input.post_stream.posts,
      post => convertPost(post).then(cpost => result.push(cpost))).then(() => result);
  };

  this.adaptPost = function a(input) {
    return convertPost(input);
  };

  this.adaptTopics = function a(input) {
    const topics = [];
    let discourseTopics = input;
    if (!(discourseTopics instanceof Array)) {
      discourseTopics = [discourseTopics];
    }

    return Promise.each(discourseTopics, (discourseTopic) => {
      let userId = discourseTopic.post_stream.posts[0].username;
      userId = userId !== 'system' && userId !== DISCOURSE_SYSTEM_USERNAME ? parseInt(userId, 10) : userId;
      return db.topics.find({
        where: {
          discourseTopicId: discourseTopic.id,
        },
      }).then((pgTopic) => {
        const topic = {
          id: discourseTopic.id,
          dbId: pgTopic ? pgTopic.id : undefined,
          reference: pgTopic ? pgTopic.reference : undefined,
          referenceId: pgTopic ? pgTopic.referenceId : undefined,
          date: discourseTopic.created_at,
          lastActivityAt: discourseTopic.created_at,
          title: discourseTopic.title,
          read: discourseTopic.post_stream.posts[0].read,
          userId,
          tag: discourseTopic.tag,
          totalPosts: discourseTopic.post_stream.stream.length,
          retrievedPosts: discourseTopic.post_stream.posts.length,
          postIds: discourseTopic.post_stream.stream,
          posts: [],
        };

        return {
          discourseTopic,
          topic,
        };
      })
        .catch((err) => {
          logger.debug('Topic not found', discourseTopic.id, err);
        }).then((result) => {
        // logger.debug('result', result)
          if (result.discourseTopic.post_stream && result.discourseTopic.post_stream.posts) {
            return Promise.each(result.discourseTopic.post_stream.posts,
              discoursePost => helper.mentionUserIdToHandle(discoursePost.cooked)
              .then((postBody) => {
                let userId = discoursePost.username; //eslint-disable-line
                userId = userId !== 'system' && userId !== DISCOURSE_SYSTEM_USERNAME ? parseInt(userId, 10) : userId;
                // ignore createdAt for invited_user type posts
                if (discoursePost.action_code !== 'invited_user'
                  && discoursePost.created_at > result.topic.lastActivityAt) {
                  result.topic.lastActivityAt = discoursePost.created_at; //eslint-disable-line
                }
                if (discoursePost.action_code === 'invited_user' && discoursePost.action_code_who) {
                  result.topic.retrievedPosts -= 1; // eslint-disable-line
                  result.topic.posts.push({
                    id: discoursePost.id,
                    date: discoursePost.created_at,
                    userId,
                    read: true,
                    body: `${discoursePost.action_code_who} joined the discussion`,
                    type: 'user-joined',
                  });
                } else {
                  result.topic.posts.push({
                    id: discoursePost.id,
                    date: discoursePost.created_at,
                    userId,
                    read: discoursePost.read,
                    body: postBody,
                    type: 'post',
                  });
                }
              })).then(() => result);
          }
          return result;
        })
        .then((result) => {
          topics.push(result.topic);
          return topics;
        });
    }).then(() => topics);
  };

  return this;
}

module.exports = Adapter;
