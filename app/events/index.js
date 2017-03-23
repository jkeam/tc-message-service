const projectMemberAddedHandler = require('./projectMemberAdded');
const projectMemberRemovedHandler = require('./projectMemberRemoved');

module.exports = () => ({
  'project.member.added': projectMemberAddedHandler,
  'project.member.removed': projectMemberRemovedHandler,
});
