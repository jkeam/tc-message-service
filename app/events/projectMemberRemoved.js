

module.exports = (logger, msg, channel) => {
  const member = JSON.parse(msg.content.toString())

  // TODO Remove member.userId from all topics associated with this
  //  project (member.projectId) in Discourse
  channel.ack(msg)
  // If processing fails
  // logger.error('Error retrieving project', err, msg)
  // channel.nack(msg, false, !msg.fields.redelivered)
}
