'use strict'

var _ = require('lodash');
var Helper = require('./helper.js');
var Promise = require('bluebird');

function Adapter(logger, db) {
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

    this.adaptPosts = function(authToken, input) {
        var handle = input.username;
        var result = [];

        return Promise.each(input.post_stream.posts, (post) => {
            return userIdLookup(authToken, post.username).then(userId => {
                result.push(convertPost(userId, post));

                return result;
            });
        }).then(() => {
            return result;
        });
    }

    this.adaptPost = function(input, authToken) {
        var handle = input.username;

        return userIdLookup(authToken, handle).then(userId => {
            return convertPost(userId, input); 
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
                return db.topics.find({
                    where: {
                        discourseTopicId: discourseTopic.id
                    }
                }).then(pgTopic => {
                    var topic = {
                        id: discourseTopic.id,
                        reference: pgTopic ? pgTopic.reference : undefined,
                        referenceId: pgTopic ? pgTopic.referenceId : undefined,
                        date: discourseTopic.created_at,
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
                });
            }).then(result => {
                if(result.discourseTopic.post_stream && result.discourseTopic.post_stream.posts) {
                    return Promise.each(result.discourseTopic.post_stream.posts, discoursePost => {
                        var postHandle = discoursePost.username;

                        return userIdLookup(authToken, postHandle).then(userId => {
                            if(discoursePost.action_code == 'invited_user' && discoursePost.action_code_who) {
                                result.topic.totalPosts--;
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
