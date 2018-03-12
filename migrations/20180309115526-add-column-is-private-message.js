'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    queryInterface.addColumn(
      'topics',
      'isPrivateMessage', {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
      }
    );
  },

  down: function (queryInterface, Sequelize) {
    queryInterface.removeColumn(
      'topics',
      'isPrivateMessage'
    );
  },
};
