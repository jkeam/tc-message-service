'use strict'

var _ = require('lodash');
var config = require('config');
var jwt = require('jsonwebtoken');
var crypto = require('crypto');
var querystring = require('querystring');
var axios = require('axios');


/**
 * Handles discourse sso
 * logger: the logger
 */
module.exports = (logger) => {    

    /**
     * Handles discorse sso
     * 
     * req: the http request
     * resp: the http response
     */
    return (req, resp) => {
        var payload = req.query.sso;
        var sig = req.query.sig;
        var secret = config.discourseSSO.secret;
        var loginUrl = config.discourseSSO.loginUrl;

        if (!payload || !sig) {
            return resp.redirect(loginUrl);
        }

        // verify payload integrity (hmac-sha256)
        var hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');
        if (hash !== sig) {
            logger.info('The discourse sso payload fails the integrity check.')
            return resp.redirect(loginUrl);
        }

        // get jwt token from cookie
        logger.info(req.cookies);
        var jwtToken = req.cookies[config.discourseSSO.loginCookieName];
        logger.info('jwtToken=' + jwtToken);
        if (!jwtToken) {
            return resp.redirect(loginUrl);
        }

        // parse jwtToken to get user handle
        jwt.verify(jwtToken, config.authSecret, (err, decoded) => {
            if (err) {
                logger.error(err, 'The jwt token is invalid.');
                // token is invalid, relogin
                return resp.redirect(loginUrl);
            }

            logger.debug(decoded);

            var userId = decoded.userId.toString();
            var handle = decoded.handle;
            var isAdmin = _.indexOf(decoded.roles, 'administrator') >= 0;

            // get user info from identity service
            axios.get(config.userServiceUrl + '/' + userId, {
                headers: {
                    'Authorization': 'Bearer ' + jwtToken,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: 3000
            }).then((response) => {
                if (response.data && response.data.result
                    && response.data.result.status == 200 && response.data.result.content) {
                    var userInfo = response.data.result.content;

                    // extract the nonce from the payload
                    var nonce = querystring.parse((new Buffer(payload, 'base64')).toString('utf8')).nonce;

                    var data = {
                        nonce: nonce,
                        username: userId,
                        name: userInfo.firstName + ' ' + userInfo.lastName,
                        email: userInfo.email,
                        external_id: handle,
                        require_activation: false,
                        admin: isAdmin,
                        suppress_welcome_message: true
                    };

                    logger.debug(data);

                    // generate the response payload
                    payload = (new Buffer(querystring.stringify(data))).toString('base64');

                    // create hmac-sha256 of response payload
                    hash = crypto.createHmac('sha256', secret).update(payload).digest('hex');

                    resp.redirect(config.discourseURL + '/session/sso_login?' +
                         querystring.stringify({
                             sso: payload,
                             sig: hash
                         }));

                } else {
                    logger.error(response.data);
                    return resp.redirect(loginUrl);
                }                

            }).catch((error) => {
                logger.error(error);
                return resp.redirect(loginUrl);
            });

        });

    }
}