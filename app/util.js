

const _ = require('lodash');
const config = require('config');
const jwt = require('jsonwebtoken');


let token = null;
/**
 * verify if token has not expired
 * @param  {[type]}  _token [description]
 * @return {Boolean}        [description]
 */
function isValid(_token) {
  const decoded = jwt.decode(_token, { complete: true });
  const now = (Date.now() / 100) - 100;
  if (decoded) {
    return decoded.payload.exp > now;
  }
  return false;
}

const util = _.cloneDeep(require('tc-core-library-js').util(config));

_.assign(util, {
  /**
   * Retrieve valid system user token
   * @param  {Object} logger [description]
   * @param  {String} _id     [description]
   * @return {Promise}       promise that resolves auth token
   */
  getSystemUserToken: (logger, _id) => {
    if (token && isValid(token)) {
      return Promise.resolve(token);
    }

    const id = _id || 'system';
    const httpClient = util.getHttpClient({ id, log: logger });
    const url = `${config.get('identityServiceEndpoint')}authorizations/`;
    // eslint-disable-next-line
    const formData = `clientId=${config.get('systemUserClientId')}&secret=${encodeURIComponent(config.get('systemUserClientSecret'))}`;
    // logger.debug(url, formData)
    return httpClient.post(url, formData,
      {
        timeout: 4000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
    .then((res) => {
      token = res.data.result.content.token;
      // console.log('\n\n\nTOKEN:', token)
      return token;
    });
  },
});

module.exports = util;
