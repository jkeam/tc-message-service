var fs = require('fs')
var parse = require('csv-parse')
var axios = require('axios')
var config = require('config')
var Helper = require('../services/helper')
var _ = require('lodash')
var coreLib = require('tc-core-library-js')
var CHUNK_SIZE = 5

var args = process.argv.slice(2)
if (args.length != 1) {
  console.log('Please provide a valid CSV file')
  return
}

var logger = coreLib.logger({
  name: 'handleToUserId',
  level: _.get(config, "logLevel", 'debug').toLowerCase(),
  captureLogs: 'false',
  logentriesToken: null
})
var helper = Helper(logger)


var opts = {
  delimiter: ',',
  columns: true
}

/**
 * Discourse client configuration
 */

var client = null

var getClient = () => {
  if (client) return client
  const DISCOURSE_SYSTEM_USERNAME = config.get('discourseSystemUsername')

client = axios.create({
  baseURL: config.get('discourseURL')
})
client.defaults.params = {
  api_key: config.get('discourseApiKey'),
  api_username: DISCOURSE_SYSTEM_USERNAME
}
client.interceptors.response.use((resp) => {
  logger.debug('SUCCESS', resp.request.path)
  return resp
}, (err) => {
  logger.error('Discourse call failed: ', _.pick(err.response, ['config', 'data']))
  return Promise.reject(err)
})
return client
}

const updateRecord = item => {
  if (_.indexOf(['system', 'devops'], item.username) > -1) {
    logger.info(`skipping ${item.username}..`)
    return Promise.resolve({})
  }
  return helper.getTopcoderUser(item.username)
  .then(user => {
    // change username
    var client = getClient()
    return client.put(`/users/${item.username}/preferences/username`, {
      new_username: user.userId.toString()
    })
    .then(() => {
      // update custom tc_handle field and title
      return client.put(`/users/${user.userId}.json`, {
        user_fields: { "1": user.handle },
        name: user.firstName + " " + user.lastName
      })
    })
    .catch(err => logger.error(err))
  })
  .catch(err => logger.error(err))

}


var parser = parse(opts, (err, data) => {
  if (err) {
    logger.error(err)
    return
  }
  var chunks = _.chunk(data, CHUNK_SIZE)
  var count = 0
  _.each(chunks, chunk => {
    setTimeout(() => {
      logger.error(`chunk ${count}: ${chunk.length}`)
      _.each(chunk, item => updateRecord(item))
    }, 1000 * count)
    count++
  })
})

fs.createReadStream(args[0]).pipe(parser)
