'use strict'

var _ = require('lodash');
var config = require('config');
var util = require('tc-core-library-js').util(config);
var Promise = require('bluebird');
var Discourse = require('../../services/discourse');

module.exports = (logger, db) => {
    var discourseClient = Discourse(logger);

    return (req, resp, next) => {
        console.log(req);
        return  discourseClient.createPost(req.authUser.handle, req.body.message, req.params.threadId).then((response) => {
            logger.info('Message created');
            resp.status(200).send({
                message: 'Message created'
            });
        }).catch((error) => {
            logger.error(error);
            return resp.status(error.response.status).send({
                message: 'Error creating thread'
            });
        });
    }

} 
