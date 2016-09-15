'use strict'

var _ = require('lodash');
var Helper = require('./helper.js');
var Promise = require('bluebird');

function Adapter(logger) {
    var helper = Helper(logger);
    var handleMap = {
        system: 'system' 
    };

    function userIdLookup(authToken, handle) {
        return new Promise((resolve, reject) => {
            if(handleMap[handle]) {
                resolve(handleMap[handle]);
            } else {
                return helper.getTopcoderUser(authToken, handle).then(result => {
                    if(result &&
                       result.userId) {
                       resolve(result.userId);
                    } else {
                       resolve(null);
                    }
                });
            }
        });
    }

    this.adaptPost = function(input, authToken) {
        var handle = input.username;

        return userIdLookup(authToken, handle).then(userId => {
            return {
                id: input.id,
                date: input.created_at,
                userId: userId,
                read: true,
                body: input.cooked
            } 
        });
    }

    this.adaptTopics = function(input, authToken) {
        var topics = [];
        var discourseTopics = input; 
        
        if(!(discourseTopics instanceof Array)) {
            discourseTopics = [discourseTopics]; 
        }
        
        return Promise.each(discourseTopics, discourseTopic => {
            var handle = discourseTopic.post_stream.posts[0].username;

            return userIdLookup(authToken, handle).then((userId) => {
                var topic = {
                    id: discourseTopic.id,
                    date: discourseTopic.created_at,
                    title: discourseTopic.title,
                    read: discourseTopic.post_stream.posts[0].read,
                    userId: userId,
                    posts: []
                };
                
                return {
                    discourseTopic: discourseTopic,
                    topic: topic
                };
            }).then(result => {
                if(result.discourseTopic.post_stream && result.discourseTopic.post_stream.posts) {
                    return Promise.each(result.discourseTopic.post_stream.posts, discoursePost => {
                        var postHandle = discoursePost.username;

                        return userIdLookup(authToken, postHandle).then(userId => {
                            result.topic.posts.push({
                                id: discoursePost.id,
                                date: discoursePost.created_at,
                                userId: userId,
                                read: discoursePost.read,
                                body: discoursePost.cooked
                            }); 
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
