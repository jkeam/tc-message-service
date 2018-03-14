const _ = require('lodash');
const Helper = require('./helper.js');
const Promise = require('bluebird');
const config = require('config');

const DISCOURSE_SYSTEM_USERNAME = config.get('discourseSystemUsername');

// storing a reference to handle to userId lookup
// FIXME: (parth) this map will grow eventually as more users are added,
// consider using external cache instead
const handleMap = { system: 'system' };
handleMap[DISCOURSE_SYSTEM_USERNAME] = DISCOURSE_SYSTEM_USERNAME;

function Adapter(logger, db, _discourseClient = null) {// eslint-disable-line
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
    let userId = input.createdBy;
    userId = userId !== 'system' && userId !== DISCOURSE_SYSTEM_USERNAME ? parseInt(userId, 10) : userId;
    return helper.mentionUserIdToHandle(input.raw)
      .then(postBody => ({
        id: input.id,
        date: input.createdAt,
        updatedDate: input.updatedAt,
        userId,
        read: true,
        body: postBody,
        rawContent: input.raw,
        type: 'post',
      }));
  }

  this.adaptPosts = function a(posts) {
    const result = [];

    return Promise.each(posts,
      post => convertPost(post).then(cpost => result.push(cpost))).then(() => result);
  };

  this.adaptPost = function a(input) {
    return convertPost(input);
  };

  this.adaptTopic = function a({ dbTopic, totalPosts, reqUserId }) {
    const topicsPostsCount = [{ topicId: dbTopic.id, totalPosts }];
    const topics = this.adaptTopics({ dbTopics: [dbTopic], topicsPostsCount, reqUserId });
    return topics && topics.length > 0 ? topics[0] : dbTopic;
  };

  this.adaptTopics = function a({ dbTopics, topicsPostsCount, reqUserId }) {
    // console.log(topicsPostsCount, 'topicsPostsCount');
    // console.log(dbTopics, 'dbTopics');
    const topics = _.map(dbTopics, (dbTopic) => {
      let userId = dbTopic.createdBy;
      userId = userId !== 'system' && userId !== DISCOURSE_SYSTEM_USERNAME ? parseInt(userId, 10) : userId;
      const totalPosts = _.find(topicsPostsCount, tpc => tpc.topicId === dbTopic.id).totalPosts;
      const topic = {
        id: dbTopic.id,
        dbId: dbTopic.id,
        reference: dbTopic.reference,
        referenceId: dbTopic.referenceId,
        tag: dbTopic.tag,
        date: dbTopic.createdAt,
        updatedDate: dbTopic.updatedAt,
        lastActivityAt: dbTopic.updatedAt,
        title: dbTopic.title,
        userId,
        totalPosts,
        retrievedPosts: dbTopic.posts ? dbTopic.posts.length : 0,
        postIds: _.map(dbTopic.posts, p => p.id),
        posts: [],
      };
      _.each(dbTopic.posts, (dbPost) => {
        const userStats = dbPost.userStats;
        const readStats = userStats ? _.find(userStats, s => s.action === 'READ') : null;
        let postUserId = dbPost.createdBy;
        if (['system', DISCOURSE_SYSTEM_USERNAME].indexOf(postUserId) === -1) {
          postUserId = Number(postUserId);
        }
        topic.posts.push({
          id: dbPost.id,
          date: dbPost.createdAt,
          updatedDate: dbPost.updatedAt,
          userId: postUserId,
          read: readStats ? readStats.userIds.indexOf(reqUserId) !== -1 : false,
          body: dbPost.raw,
          rawContent: dbPost.raw,
          type: 'post',
        });
      });
      logger.debug(topic.posts, 'topic.posts');
      if (topic.posts && topic.posts.length > 0) {
        topic.posts = _.orderBy(topic.posts, ['date', 'id'], ['asc', 'asc']);
        topic.read = topic.posts[0].read;
        const lastPost = topic.posts[topic.posts.length - 1];
        topic.lastActivityAt = lastPost.updatedDate ? lastPost.updatedDate : lastPost.date;
      }
      // console.log(topic, 'topic');
      return topic;
    });
    return topics;
  };

  return this;
}

module.exports = Adapter;
