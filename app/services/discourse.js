'use strict'
var Promise = require('bluebird');
var config = require('config');
var axios = require('axios');

/**
 * Service to facilitate communication with the discourse api
 * logger: the logger
 */
var Discourse = (logger) => {

    /**
     * Discourse client configuration
     */
    var discourseClientConfig = {
        baseURL: config.get('discourseURL')
    };

   /**
    * Fetches a Discourse user by username
    * username: the Discourse user name
    */
   this.getUser = (username) => {
        return axios.get('/users/' + username + '.json', {
            baseURL: config.get('discourseURL'),
            params: {
                api_key: config.get('discourseApiKey'),
                api_username: username
            }
        }).then((response) => response.data);
    }

    /**
     * Creates a new user in Discourse
     * name: first and last name of the user
     * username: username, must be unique
     * email: email of the user, must be unique
     * password: password of the user, this will be ignored since we will be using SSO
     */
    this.createUser = (name, username, email, password) => {
        return axios.post('/users?api_key=' + config.get('discourseApiKey') + '&api_username=system', {
            name: encodeURIComponent(name),
            username: username,
            email: email,
            password: password,
            active: true
        }, discourseClientConfig);
    }

    /**
     * Creates a private post in discourse
     * title: the title of the post
     * post: the body of the post, html markup is allowed
     * users: comma separated list of user names that should be part of the conversation
     */
    this.createPrivatePost = (title, post, users) => {
        return axios.post('/posts?api_key=' + config.get('discourseApiKey') + '&api_username=system&archetype=private_message&target_usernames=' + users +
            '&title=' + encodeURIComponent(title) +
            '&raw=' + encodeURIComponent(post), '', discourseClientConfig);
    }

    /**
     * Gets a topic in Discourse
     * topicId: the id of the topic
     * username: the username to use to fetch the topic, for security purposes
     */
    this.getTopic = (topicId, username) => {
        return axios.get('/t/' + topicId + '.json?api_key=' + config.get('discourseApiKey') + '&api_username=' + username,
            discourseClientConfig).then((response) => response.data);
    }

    /**
     * Grants access to a user by adding that user to the Discrouse topic (or private post)
     * userName: identifies the user that should receive access
     * topicId: identifier of the topic to which access should be granted
     */
    this.grantAccess = (userName, topicId) => {
        return axios.post('/t/' + topicId + '/invite?api_key=' + config.get('discourseApiKey') + '&api_username=system', {
            user: userName
        }, discourseClientConfig);
    }

    /**
     * Creates a post (reply) to a topic
     * username: user creating the post
     * post: body of the post, html markup is permitted
     * discourseTopicId: the topic id to which the response is being posted
     */
    this.createPost = (username, post, discourseTopicId, responseTo) => {
        var data = 'topic_id=' + discourseTopicId + '&raw=' + encodeURIComponent(post);
        if(responseTo) {
          data += '&reply_to_post_number=' + responseTo;
        }
        return axios.post('/posts?api_key=' + config.get('discourseApiKey') + '&api_username=' + username,
            data, discourseClientConfig);
    }

    this.markTopicPostsRead = (username, topicId, postIds) => {
        var parts = ['topic_id=' + topicId, 'topic_time=' + topicId];
        postIds.forEach(postId => {
            parts.push(encodeURIComponent('timings[' + postId + ']') + '=1000');
        });
        return axios.post('/topics/timings.json?api_key=' + config.get('discourseApiKey') +
                          '&api_username=' + username,
                          parts.join('&'), discourseClientConfig);
    }

    return this;
}

module.exports = Discourse;
