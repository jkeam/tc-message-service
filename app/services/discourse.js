'use strict'

var Promise = require('bluebird');
var config = require('config');
var axios = require('axios');


var Discourse = (logger) => {

    var discourseClient = axios.create({
        baseURL: config.discourseURL
    });
   
   this.getUser = (username) => {
        return new Promise((resolve, reject) => {
            discourseClient.get('/users/' + username + '.json', {
                params: {
                    api_key: config.discourseApiKey,
                    api_username: username
                }
            }).then((response) => {
                resolve(response.data);
            }).catch((error) => {
                reject(error);
            });
        });
    }

    this.createUser = (name, username, email, password) => {
        return discourseClient.post('/users?api_key=' + config.discourseApiKey + '&api_username=system', {
            name: encodeURIComponent(name),
            username: username,
            email: email,
            password: password,
            active: true
        });
    }

    this.createPrivateMessage = (title, message, users) => {
        return discourseClient.post('/posts?api_key=' + config.discourseApiKey + '&api_username=system&archetype=private_message&target_usernames=' + users +
            '&title=' + encodeURIComponent(title) +
            '&raw=' + encodeURIComponent(message));
    }

    this.getThread = (threadId, username) => {
        return discourseClient.get('/t/' + threadId + '.json?api_key=' + config.discourseApiKey + '&api_username=' + username);
    }

    this.grantAccess = (userName, threadId) => {
        return discourseClient.post('/t/' + threadId + '/invite?api_key=' + config.discourseApiKey + '&api_username=system', {
            user: userName
        });
    }

    return this;
}

module.exports = Discourse;
