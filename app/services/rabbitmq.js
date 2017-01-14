var _ = require('lodash')
var msgHandlers = require('../events')()

module.exports = (logger) => {
  var logger = logger
  var _subConn = null
  // var _pubConn = null
  var _subQueue = null
  var exchangeName = null
  var queueName = null

  /**
   * initialize rabbit mq connections / exchanges/ queues etc
   * @return {Promise} Resolved or rejected promise
   */
  var init = (rabbitmqURL, _exchangeName, _queueName) => {
    exchangeName = _exchangeName
    queueName = _queueName
    // return _createConnection(rabbitmqURL)
    //   .then((conn) => {
    //     logger.debug('Publisher connection created')
    //     _pubConn = conn
    //       // subscriber connection
      return _createConnection(rabbitmqURL)
      .then((conn) => {
        logger.debug('Subscriber connection created')
        _subConn = conn
        return _initSubscriber()
      })
      .catch((err) => {
        logger.error(err)
      })
  }

  /**
   * helper function to create a connection to rabbitmq
   * @param  {string} rabbitUrl url to connect to
   * @return {promise}           promise
   */
  function _createConnection(rabbitUrl) {
    return require('amqplib').connect(rabbitUrl)
  }

  /**
   * Helper function to handle initializing subscribers
   * @return {promise} resolved promise
   */
   function _initSubscriber() {
    var self = this
    var channel = null
      // create channel to setup exchanges + queues + bindings
      // on subscriber connection
    return _subConn.createChannel()
      .then((ch) => {
        // assert / create exchanges
        logger.debug('Channel created', exchangeName)
        channel = ch
        return channel.assertExchange(exchangeName, 'topic', {
          durable: true
        })
      }).then(() => {
        // create queue
        // a single queue for project service will suffice
        logger.debug('Exchange created')
          // with default params - exclusive:false, durable: true, autoDelete: false
        return channel.assertQueue(queueName)
      }).then((qok) => {
        logger.debug('Queue %s created', queueName)
        _subQueue = qok.queue
          // bindings for the queue
          // all these keys/bindings should be routed to the same queue
        const bindings = _.keys(msgHandlers)
        logger.debug('Adding bindings: ', bindings)
        var bindingPromises = _.map(bindings, (rk) => {
          return channel.bindQueue(_subQueue, exchangeName, rk)
        })
        return Promise.all(bindingPromises)
      }).then(() => {
        _subChannel = channel
        return channel.consume(_subQueue, (msg) => {
          const key = msg.fields.routingKey
            // create a child logger so we can trace with original request id
          const _childLogger = logger.child({
            requestId: msg.properties.correlationId
          })
          _childLogger.debug('Received Message', key, msg.fields)
          const handler = msgHandlers[key]
          if (!_.isFunction(handler)) {
            _childLogger.error(`Unknown message type: ${key}, NACKing... `)
              // channel.nack(msg, false, false)
          } else {
            handler(_childLogger, msg, channel)
          }
        })
      }).then(() => {
        logger.info('Waiting for messages .... ')
      }).catch((err) => {
        // channel.close()
        logger.error(err)
      })
  }


  /**
   * gracefully shutdown any open connections
   * @return {[type]} [description]
   */
  var disconnect = () => {
    // TODO shutdown channel
    // shutdown connections
    var self = this
    return new Promise((resolve) => {
      var promises = _.map([_subConn, _pubConn], (conn) => {
        conn.close()
      })
      Promise.all(promises)
        .then(() => {
          logger.info('Disconnected from rabbitmq')
          resolve()
        }).catch((err) => {
          logger.error('ERROR Closing connection', err)
        })
    })
  }

  /**
   * Publish message to default exchange
   * @param  {string} key     routing key
   * @param  {object} payload message payload
   */
  var publish = (key, payload, props) => {
    props = props || {}
    var channel = null
    var self = this
      // first create a channel - this is a lightweight connection
    return _pubConn.createChannel()
      .then((ch) => {
        channel = ch
          // make sure the exchance exisits, else create it
        return channel.assertExchange(exchangeName, 'topic', {
          durable: true
        })
      }).then(() => {
        // publish the message
        props = _.defaults(props, {
          contentType: 'application/json'
        })
        channel.publish(
          exchangeName,
          key,
          new Buffer(JSON.stringify(payload)),
          props
        )
        logger.debug('Sent %s: %s', exchangeName, payload)
        return channel.close()
      })
      .catch((err) => {
        logger.error(err)
        return channel.close()
      })
  }

  return {
    init,
    // publish,
    disconnect,

  }
}
