const _ = require('lodash');
const msgHandlers = require('../events')();
const amqplib = require('amqplib');

module.exports = (logger) => {
  let subConn = null;
  let pubConn = null; // eslint-disable-line
  let subQueue = null;
  let exchangeName = null;
  let queueName = null;

  /**
   * Helper function to handle initializing subscribers
   * @return {promise} resolved promise
   */
  function initSubscriber() {
    let channel = null;
      // create channel to setup exchanges + queues + bindings
      // on subscriber connection
    return subConn.createChannel()
      .then((ch) => {
        // assert / create exchanges
        logger.debug('Channel created', exchangeName);
        channel = ch;
        return channel.assertExchange(exchangeName, 'topic', {
          durable: true,
        });
      }).then(() => {
        // create queue
        // a single queue for project service will suffice
        logger.debug('Exchange created');
          // with default params - exclusive:false, durable: true, autoDelete: false
        return channel.assertQueue(queueName);
      }).then((qok) => {
        logger.debug('Queue %s created', queueName);
        subQueue = qok.queue;
          // bindings for the queue
          // all these keys/bindings should be routed to the same queue
        const bindings = _.keys(msgHandlers);
        logger.debug('Adding bindings: ', bindings);
        const bindingPromises = _.map(bindings, rk => channel.bindQueue(subQueue, exchangeName, rk));
        return Promise.all(bindingPromises);
      })
      .then(() => channel.consume(subQueue, (msg) => {
        const key = msg.fields.routingKey;
            // create a child logger so we can trace with original request id
        const childLogger = logger.child({
          requestId: msg.properties.correlationId,
        });
        childLogger.debug('Received Message', key, msg.fields);
        const handler = msgHandlers[key];
        if (!_.isFunction(handler)) {
          childLogger.error(`Unknown message type: ${key}, NACKing... `);
              // channel.nack(msg, false, false)
        } else {
          handler(childLogger, msg, channel);
        }
      }))
      .then(() => {
        logger.info('Waiting for messages .... ');
      })
      .catch((err) => {
        // channel.close()
        logger.error(err);
      });
  }

  /**
   * helper function to create a connection to rabbitmq
   * @param  {string} rabbitUrl url to connect to
   * @return {promise}           promise
   */
  function createConnection(rabbitUrl) {
    return amqplib.connect(rabbitUrl);
  }
  /**
   * initialize rabbit mq connections / exchanges/ queues etc
   * @param {String} rabbitmqURL url
   * @param {String} _exchangeName name of exchange
   * @param {String} _queueName name of queue
   * @return {Promise} Resolved or rejected promise
   */
  const init = (rabbitmqURL, _exchangeName, _queueName) => {
    exchangeName = _exchangeName;
    queueName = _queueName;
    // subscriber connection
    return createConnection(rabbitmqURL)
    .then((conn) => {
      logger.debug('Subscriber connection created');
      subConn = conn;
      return initSubscriber();
    })
    .catch((err) => {
      logger.error(err);
    });
  };

  /**
   * gracefully shutdown any open connections
   * @return {[type]} [description]
   */
  const disconnect = () => { // eslint-disable-line
    // TODO shutdown channel
    // shutdown connections
    return new Promise((resolve) => {
      const promises = _.map([subConn], (conn) => { // pubConn
        conn.close();
      });
      Promise.all(promises)
        .then(() => {
          logger.info('Disconnected from rabbitmq');
          resolve();
        }).catch((err) => {
          logger.error('ERROR Closing connection', err);
        });
    });
  };

  /**
   * Publish message to default exchange
   * @param  {string} key     routing key
   * @param  {object} payload message payload
   * @param  {object} _props additional properites
   * @return {Promise} promise
   */
  const publish = (key, payload, _props) => { // eslint-disable-line
    let props = _props || {}; //
    let channel = null;
      // first create a channel - this is a lightweight connection
    return pubConn.createChannel()
      .then((ch) => {
        channel = ch;
          // make sure the exchance exisits, else create it
        return channel.assertExchange(exchangeName, 'topic', {
          durable: true,
        });
      }).then(() => {
        // publish the message
        props = _.defaults(props, {
          contentType: 'application/json',
        });
        channel.publish(
          exchangeName,
          key,
          new Buffer(JSON.stringify(payload)),
          props);
        logger.debug('Sent %s: %s', exchangeName, payload);
        return channel.close();
      })
      .catch((err) => {
        logger.error(err);
        return channel.close();
      });
  };

  return {
    init,
    // publish,
    disconnect,
  };
};
