const events = require('events');
const concat = require('concat-stream');

module.exports = function upload(opts) {
  const eventEmitter = new events.EventEmitter();

  eventEmitter.send = function send(cb) {
    opts.Body.pipe(concat((body) => {
      eventEmitter.emit('httpUploadProgress', { total: body.length });
      cb(null, {
        Location: 'mock-location',
        ETag: 'mock-etag',
      });
    }));
  };

  return eventEmitter;
};
