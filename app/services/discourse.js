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
        return new Promise((resolve, reject) => {
            axios.get('/users/' + username + '.json', {
                baseURL: config.get('discourseURL'),
                params: {
                    api_key: config.get('discourseApiKey'),
                    api_username: username
                }
            }).then((response) => {
                resolve(response.data);
            }).catch((error) => {
                reject(error);
            });
        });
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
     * Creates a private message in discourse
     * title: the title of the message
     * message: the body of the message, html markup is allowed
     * users: comma separated list of user names that should be part of the conversation
     */
    this.createPrivateMessage = (title, message, users) => {
        return axios.post('/posts?api_key=' + config.get('discourseApiKey') + '&api_username=system&archetype=private_message&target_usernames=' + users +
            '&title=' + encodeURIComponent(title) +
            '&raw=' + encodeURIComponent(message), "", discourseClientConfig);
    }

    /**
     * Gets a thread in Discourse
     * threadId: the id of the thread
     * username: the username to use to fetch the thread, for security purposes
     */
    this.getThread = (threadId, username) => {
        console.log('/t/' + threadId + '.json?api_key=' + config.get('discourseApiKey') + '&api_username=' + username);
        return axios.get('/t/' + threadId + '.json?api_key=' + config.get('discourseApiKey') + '&api_username=' + username, discourseClientConfig);
    }

    /**
     * Grants access to a user by adding that user to the Discrouse thread (or private message)
     * userName: identifies the user that should receive access
     * threadId: identifier of the thread to which access should be granted
     */
    this.grantAccess = (userName, threadId) => {
        return axios.post('/t/' + threadId + '/invite?api_key=' + config.get('discourseApiKey') + '&api_username=system', {
            user: userName
        }, discourseClientConfig);
    }

    /**
     * Creates a post (reply) to a threa
     * username: user creating the post
     * message: body of the message, html markup is permitted
     * discourseThreadId: the thread id to which the response is being posted
     */
    this.createPost = (username, message, discourseThreadId) => {
        return axios.post('/posts?api_key=' + config.get('discourseApiKey') + '&api_username=' + username,
            'topic_id=' + discourseThreadId +
            '&raw=' + encodeURIComponent(message), discourseClientConfig);
    }

    return this;
}

module.exports = Discourse;
