const crypto = require('crypto');
const config = require('config');

const discourseWebhookSecret = config.get('discourseWebhookSecret');

const calculateHmac = (text, prefix = '') =>
  `${prefix}${crypto.createHmac('sha256', discourseWebhookSecret).update(text).digest('hex')}`;

module.exports = { calculateHmac };
