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
    let userId = input.username;
    userId = userId !== 'system' && userId !== DISCOURSE_SYSTEM_USERNAME ? parseInt(userId, 10) : userId;
    return helper.mentionUserIdToHandle(input.cooked)
      .then(postBody => ({
        id: input.id,
        date: input.created_at,
        updatedDate: input.updated_at,
        userId,
        read: true,
        body: postBody,
        rawContent: input.raw,
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

  this.adaptTopic = function a(input) {
    const { topic, dbTopic } = input;
    const topics = this.adaptTopics({ topics: [topic], dbTopics: [dbTopic] });
    return topics && topics.length > 0 ? topics[0] : topic;
  };

  this.adaptTopics = function a(input) {
    let { topics: discourseTopics } = input;
    const pgTopics = input.dbTopics;
    if (!(discourseTopics instanceof Array)) {
      discourseTopics = [discourseTopics];
    }

    const topics = _.map(discourseTopics, (discourseTopic) => {
      let userId = discourseTopic.user_id;
      userId = userId !== 'system' && userId !== DISCOURSE_SYSTEM_USERNAME ? parseInt(userId, 10) : userId;

      const pgTopic = _.find(pgTopics, pt => pt.discourseTopicId === discourseTopic.id);
      const topic = {
        id: discourseTopic.id,
        dbId: pgTopic ? pgTopic.id : undefined,
        reference: pgTopic ? pgTopic.reference : undefined,
        referenceId: pgTopic ? pgTopic.referenceId : undefined,
        date: discourseTopic.created_at,
        updatedDate: discourseTopic.updated_at,
        lastActivityAt: discourseTopic.last_posted_at,
        title: discourseTopic.title,
        read: discourseTopic.posts[0].read,
        userId,
        tag: discourseTopic.tag,
        totalPosts: discourseTopic.posts.length,
        retrievedPosts: discourseTopic.posts.length,
        postIds: _.map(discourseTopic.posts, p => p.id),
        posts: [],
      };
      _.each(discourseTopic.posts, (discoursePost) => {
        topic.posts.push({
          id: discoursePost.id,
          date: discoursePost.created_at,
          updatedDate: discoursePost.updated_at,
          userId,
          read: discoursePost.read,
          body: discoursePost.cooked,
          rawContent: discoursePost.raw,
          type: 'post',
        });
      });
      topic.posts = _.orderBy(topic.posts, ['date'], ['asc']);
      const lastPost = topic.posts[topic.posts.length - 1];
      topic.lastActivityAt = lastPost.updatedDate ? lastPost.updatedDate : lastPost.date;

      // add utc timezone to timestamp fields
      topic.date = topic.date ? `${topic.date}Z` : null;
      topic.updatedDate = topic.updatedDate ? `${topic.updatedDate}Z` : null;
      topic.lastActivityAt = topic.lastActivityAt ? `${topic.lastActivityAt}Z` : null;
      _.each(topic.posts, (post) => {
        post.date = post.date ? `${post.date}Z` : null;// eslint-disable-line
        post.updatedDate = post.updatedDate ? `${post.updatedDate}Z` : null;// eslint-disable-line
      });
      return topic;
    });
    return topics;
  };

  return this;
}

module.exports = Adapter;
