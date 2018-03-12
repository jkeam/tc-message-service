
const Promise = require('bluebird');
const config = require('config');
const axios = require('axios');
const _ = require('lodash');
const util = require('../util');
const fs = require('fs');
const FormData = require('form-data');
const querystring = require('querystring');

const DISCOURSE_SYSTEM_USERNAME = config.get('discourseSystemUsername');

/**
 * Discourse client configuration
 */
let client = null;

/*
 * Service to facilitate communication with the discourse api
 */
module.exports = (logger) => {
  /**
   * Returns axios client
   * @return {Object} axios client
   */
  function getClient() {
    if (client) return client;
    client = axios;
    client.defaults.baseURL = config.get('discourseURL');
    client.defaults.params = {
      api_key: config.get('discourseApiKey'),
      api_username: DISCOURSE_SYSTEM_USERNAME,
    };

    // Add a response interceptor
    client.interceptors.response.use(function (res) { // eslint-disable-line
      logger.info('SUCCESS', _.pick(res, ['config.url', 'status']));
      return res;
    }, function (error) { // eslint-disable-line
      logger.error('Discourse call failed: ', _.pick(error, ['config.url', 'response.status',
        'response.data', 'response.data.errors', 'response.request']));
      return Promise.reject(error);
    });

    return client;
  }

  /**
   * Fetches a Discourse user by username
   * @param {String} username the Discourse user name
   * @return {Promise} user promise
   */
  function getUser(username) {
    return getClient().get(`/users/${username}.json?api_username=${username}`)
      .then(response => response.data);
  }

  /**
   * Creates a new user in Discourse
   * @param {String} name first and last name of the user
   * @param {Number} userId User id
   * @param {String} handle username, must be unique
   * @param {String} email email of the user, must be unique
   * @param {String} password password of the user, this will be ignored since we will be using SSO
   * * @param {String} email email of the user, must be unique
   * @return {Promise} new user promise
   */
  function createUser(name, userId, handle, email, password) {
    logger.debug('Creating user in discourse:', name, userId, handle);
    return getClient().post('/users', {
      name,
      username: userId,
      email,
      password,
      active: true,
      user_fields: { 1: handle },
    });
  }

  /**
   * Creates a private post in discourse
   * @param {String} title the title of the post
   * @param {Object} post the body of the post, html markup is allowed
   * @param {Array} users comma separated list of user names that should be part of the conversation
   * @param {String} owner user who created the post
   * @return {Promise} new post promise
   */
  function createPrivatePost(title, post, users, owner) {
    return getClient().post('/posts', {
      archetype: 'private_message',
      target_usernames: users,
      title,
      raw: post,
    }, {
      params: {
        api_username: owner && !util.isDiscourseAdmin(owner) ? owner : DISCOURSE_SYSTEM_USERNAME,
      },
    })
      .catch((err) => {
        logger.error('Error creating topic');
        logger.error(err);
        return Promise.reject(err);
      });
  }

  /**
   * Create a new topic
   * @param {String}  title           the title of the topic
   * @param {String}  post            the body of the topic, html markup is allowed
   * @param {String}  owner           user who created the topic
   * @param {Number}  categoryId      (optional) category of the topic
   * @return {Promise} promise
   */
  function createTopic(title, post, owner, categoryId) {
    const data = {
      title,
      raw: post,
    };

    if (categoryId) {
      data.category = categoryId;
    }

    return getClient().post('/posts', data, {
      params: {
        api_username: owner && !util.isDiscourseAdmin(owner) ? owner : DISCOURSE_SYSTEM_USERNAME,
      },
    });
  }

  /**
   * Gets a topic in Discourse
   * @param {String} topicIds the ids of the topic
   * @param {String} username the username to use to fetch the topic, for security purposes
   * @return {Promise} get topic promise
   */
  function getTopics(topicIds, username) {
    logger.debug(`Retrieving topics# ${topicIds} for user: ${username}`);
    getClient();

    const getTopicsPromise = () => {
      const params = { topic_list: topicIds.join(','), uid: username };
      return this.runQuery(client.topicsQueryId, params)
      .then((response) => {
        logger.debug('got response', response);
        const columns = response.data.columns;
        const rows = response.data.rows;
        const topicsById = _.groupBy(rows, row => row[columns.indexOf('topic_id')]);
        logger.debug(topicsById);
        const topics = [];
        _.forEach(_.keys(topicsById), (topicId) => {
          const topic = {
            id: topicsById[topicId][0][columns.indexOf('topic_id')],
            user_id: topicsById[topicId][0][columns.indexOf('topic_user_id')],
            created_at: topicsById[topicId][0][columns.indexOf('topic_created_at')],
            updated_at: topicsById[topicId][0][columns.indexOf('topic_updated_at')],
            last_posted_at: topicsById[topicId][0][columns.indexOf('topic_last_posted_at')],
            title: topicsById[topicId][0][columns.indexOf('topic_title')],
            allowed_users: topicsById[topicId][0][columns.indexOf('allowed_users')],
            posts: [],
          };
          if (topic.allowed_users) {
            topic.allowed_users = topic.allowed_users.split(',');
          }
          _.forEach(topicsById[topicId], (row) => {
            const post = {
              id: row[columns.indexOf('post_id')],
              cooked: row[columns.indexOf('post_cooked')],
              raw: row[columns.indexOf('post_raw')],
              user_id: row[columns.indexOf('post_user_id')],
              created_at: row[columns.indexOf('post_created_at')],
              updated_at: row[columns.indexOf('post_updated_at')],
              post_number: row[columns.indexOf('post_post_number')],
              read: row[columns.indexOf('post_read')],
            };
            topic.posts.push(post);
          });
          topic.read = _.every(topic.posts, { read: true });
          topics.push(topic);
        });
        return topics;
      })
      .catch((err) => {
        logger.error('Error executing topics query');
        logger.error(err);
        return Promise.reject(err);
      });
    };

    if (!client.topicsQueryId) {
      return this.getQueryId('Connect_Topics_Query')
        .then((queryId) => {
          client.topicsQueryId = queryId;

          return getTopicsPromise();
        });
    }

    return getTopicsPromise();
  }

  /**
   * Get query id by query name from Data Explorer plugin of Discourse.
   * @param {String} queryName query name
   * @return {Promise} promise
   */
  function getQueryId(queryName) {
    return getClient().get('admin/plugins/explorer/queries.json', {
      params: {
        api_username: DISCOURSE_SYSTEM_USERNAME,
      },
    })
      .then((response) => {
        const query = _.find(response.data.queries, { name: queryName });

        if (!query) {
          throw new Error(`Cannot find query '${queryName}' in Data Explorer plugin of Discourse.`);
        }

        return query.id;
      })
      .catch((err) => {
        logger.error('Error getting query id');
        logger.error(err);
        return Promise.reject(err);
      });
  }

  function runQuery(queryId, params, limit) {
    return getClient().post(`admin/plugins/explorer/queries/${queryId}/run`,
      querystring.stringify({ params: JSON.stringify(params), format: 'json', limit: limit || 100000 }), {
        params: {
          api_username: DISCOURSE_SYSTEM_USERNAME,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;',
        },
      });
  }

  /**
   * Updates a topic in Discourse
   * @param {String} username the username to use to fetch the topic, for security purposes
   * @param {String} topicId the id of the topic
   * @param {String} title (optional) the title of the topic
   * @param {Number} categoryId (optional) the id of topic category
   * @return {Promise} update topic promise
   */
  function updateTopic(username, topicId, title, categoryId) {
    logger.debug(`Update topic# ${topicId} for user: ${username}`);
    const data = { topic_id: topicId };

    if (title) {
      data.title = title;
    }

    if (categoryId) {
      data.category_id = categoryId;
    }

    return getClient().put(`/t/${topicId}.json`, data, {
      params: {
        api_username: username && !util.isDiscourseAdmin(username) ? username : DISCOURSE_SYSTEM_USERNAME,
      },
    });
  }

  /**
   * Convert topic from private messages to public
   * @param {String} topicId the id of the topic
   * @return {Promise} promise
   */
  function convertTopicToPublic(topicId) {
    logger.debug(`Converting topic ${topicId} to public...`);

    return getClient().put(`/t/${topicId}/convert-topic/public`, {
      params: {
        api_username: DISCOURSE_SYSTEM_USERNAME,
      },
    });
  }

  /**
   * Delete a post (reply) of a topic
   * @param {String} username user deleting the topic
   * @param {Number} topicId topic id
   * @return {Promise} promise
   */
  function deleteTopic(username, topicId) {
    return getClient().delete(`/t/${topicId}.json`, {}, {
      params: {
        api_username: util.isDiscourseAdmin(username) ? DISCOURSE_SYSTEM_USERNAME : username,
      },
    });
  }

  /**
   * Grants access to a user by adding that user to the Discrouse topic (or private post)
   * @param {String} userName identifies the user that should receive access
   * @param {String} topicId identifier of the topic to which access should be granted
   * @param {String} invitee user inviting new user to topic
   * @return {Promise} http promise
   */
  function grantAccess(userName, topicId, invitee = 'system') {
    return getClient().post(`/t/${topicId}/invite`, {
      user: userName,
    }, {
      params: { api_username: invitee },
    });
  }

  /**
   * Creates a post (reply) to a topic
   * @param {String}  username user creating the post
   * @param {Object}  post body of the post, html markup is permitted
   * @param {Number}  discourseTopicId the topic id to which the response is being posted
   * @param {Number}  responseTo reply to post id
   * @return {Promise} promise
   */
  function createPost(username, post, discourseTopicId, responseTo) {
    let data = `topic_id=${discourseTopicId}&raw=${encodeURIComponent(post)}`;
    if (responseTo) {
      data += `&reply_to_post_number=${responseTo}`;
    }

    return getClient().post('/posts', data, {
      params: {
        api_username: util.isDiscourseAdmin(username) ? DISCOURSE_SYSTEM_USERNAME : username,
      },
    });
  }

  /**
   * Fetches post from discourse
   * @param {String} username: the name of the user to use to access the Discourse API
   * @param {Number} postId the id of the post
   * @return {Promise} promise
   */
  function getPost(username, postId) {
    logger.debug('Attempting to retrieve post', postId);
    return getClient().get(`/posts/${postId}.json?`, {
      params: {
        api_username: util.isDiscourseAdmin(username) ? DISCOURSE_SYSTEM_USERNAME : username,
      },
    });
  }

  /**
   * Fetches posts from discourse
   * @param {String} username: the name of the user to use to access the Discourse API
   * @param {Number} topicId the id of the topic that is parent to the posts
   * @param {Array} postIds array containing the list of posts that should be retrieved
   * @return {Promise} promise
   */
  function getPosts(username, topicId, postIds) {
    logger.debug('Attempting to retrieve posts', postIds);
    let postIdsFilter = '';
    let separator = '';
    _(postIds).each((postId) => {
      postIdsFilter += `${separator}${encodeURIComponent('post_ids[]')}=${postId}`;
      separator = '&';
    });

    return getClient().get(`/t/${topicId}/posts.json?include_raw=1&${postIdsFilter}`, {
      params: {
        api_username: util.isDiscourseAdmin(username) ? DISCOURSE_SYSTEM_USERNAME : username,
      },
    });
  }

  /**
   * Update a post (reply) of a topic
   * @param {String} username user updating the post
   * @param {Number} postId post id
   * @param {Object} body body of the post, html markup is permitted
   * @return {Promise} promise
   */
  function updatePost(username, postId, body) {
    return getClient().put(`/posts/${postId}.json`, { post: { raw: body } }, {
      params: {
        api_username: util.isDiscourseAdmin(username) ? DISCOURSE_SYSTEM_USERNAME : username,
      },
    });
  }

  /**
   * Delete a post (reply) of a topic
   * @param {String} username user deleting the post
   * @param {Number} postId post id
   * @return {Promise} promise
   */
  function deletePost(username, postId) {
    return getClient().delete(`/posts/${postId}.json`, {}, {
      params: {
        api_username: util.isDiscourseAdmin(username) ? DISCOURSE_SYSTEM_USERNAME : username,
      },
    });
  }

  /**
   * Uploads image
   * @param {String} username user uploading the image
   * @param {Object} file image file to upload
   * @return {Promise} promise
   */
  function uploadImage(username, file) {
    const data = new FormData();
    data.append('type', 'composer');
    data.append('synchronous', 'true');
    data.append('file', fs.createReadStream(file.path), { filename: file.originalname, contentType: file.mimetype });

    return getClient().post('/uploads.json', data,
      {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${data.getBoundary()}`,
        },
        params: {
          api_username: util.isDiscourseAdmin(username) ? DISCOURSE_SYSTEM_USERNAME : username,
        },
      });
  }

  /**
   * Marks a topic and posts are read in discourse
   * @param {String} username the name of the user who read the topic
   * @param {Number} topicId the id of the topic the user read
   * @param {Array} postIds array of post ids representing the posts the user read
   * @return {Promise} promise
   */
  function markTopicPostsRead(username, topicId, postIds) {
    const parts = [`topic_id=${topicId}`, `topic_time=${topicId}`];
    postIds.forEach((postId) => {
      parts.push(`${encodeURIComponent(`timings[${postId}]`)}=1000`);
    });
    return getClient().post('/topics/timings.json', parts.join('&'), {
      params: {
        api_username: username,
      },
    });
  }

  /**
   * Changes trust level of existing user
   * @param {String} userId user's discourse user_id
   * @param {Number} level new trust level
   * @return {Promise} promise
   */
  function changeTrustLevel(userId, level) {
    logger.debug('Changing trust level of user in discourse:', userId);
    return getClient().put(`/admin/users/${userId}/trust_level`, {
      user_id: userId,
      level,
    });
  }

  /**
   * Removes access of a user from topic
   * @param {String} userName identifies the user that should be removed
   * @param {Number} topicId identifier of the topic from which access should be removed
   * @return {Promise} promise
   */
  function removeAccess(userName, topicId) {
    return getClient().put(`/t/${topicId}/remove-allowed-user`, {
      username: userName,
    }, {
      params: { api_username: 'system' },
    });
  }

  /**
   * Creates a group
   * @param {String}   groupName group name
   * @return {Promise}           response with property data.basic_group
   */
  function createGroup(groupName) {
    const data = {
      group: {
        name: groupName,
      },
    };

    return getClient().post('/admin/groups', data, {
      params: {
        api_username: DISCOURSE_SYSTEM_USERNAME,
      },
    });
  }

  /**
   * Add users to the group
   * @param {String}   groupId   group id
   * @param {Array}    usernames usernames to add
   * @return {Promise}           response with property data.success
   */
  function addUsersToGroup(groupId, usernames) {
    const data = {
      usernames: usernames.join(','),
    };

    return getClient().put(`/groups/${groupId}/members.json`, data, {
      params: {
        api_username: DISCOURSE_SYSTEM_USERNAME,
      },
    });
  }

  /**
   * Remove user from the group
   * @param {String}   groupId   group id
   * @param {String}   userId    user id to remove
   * @return {Promise}           response with property data.success
   */
  function removeUserFromGroup(groupId, userId) {
    return getClient().delete(`/groups/${groupId}/members.json`, {
      params: {
        user_id: userId,
        api_username: DISCOURSE_SYSTEM_USERNAME,
      },
    });
  }

  /**
   * Get users in the group
   * @param {String}   groupName group name
   * @param {Array}    usernames usernames to add
   * @return {Promise}           response with property data.success
   */
  function getUsersInGroup(groupName) {
    return getClient().get(`/groups/${groupName}/members.json`, {
      params: {
        api_username: DISCOURSE_SYSTEM_USERNAME,
      },
    });
  }

  /**
   * Creates a category
   * @param {String}   categoryName category name
   * @param {String}   groupName    group name which will have access to the category
   * @return {Promise}              response with property data.category
   */
  function createCategory(categoryName, groupName) {
    const data = {
      name: categoryName,
      color: 'FFFFFF',
      text_color: '000000',
    };

    if (groupName) {
      data.permissions = {};
      data.permissions[groupName] = 1;
    }

    return getClient().post('/categories.json', data, {
      params: {
        api_username: DISCOURSE_SYSTEM_USERNAME,
      },
    });
  }

  return {
    createUser,
    getUser,
    changeTrustLevel,
    grantAccess,
    removeAccess,
    createTopic,
    getTopics,
    updateTopic,
    deleteTopic,
    createPost,
    updatePost,
    deletePost,
    uploadImage,
    createPrivatePost,
    getPost,
    getPosts,
    markTopicPostsRead,
    createGroup,
    createCategory,
    addUsersToGroup,
    getUsersInGroup,
    removeUserFromGroup,
    getQueryId,
    runQuery,
    convertTopicToPublic,
  };
};
