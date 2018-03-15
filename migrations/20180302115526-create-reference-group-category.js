'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    queryInterface.createTable(
      'referenceGroupCategory', {
        id: {
          type: Sequelize.BIGINT,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        reference: {
          type: Sequelize.STRING,
          allowNull: false
        },
        referenceId: {
          type: Sequelize.STRING,
          allowNull: false
        },
        groupId: {
          type: Sequelize.BIGINT,
          allowNull: false
        },
        groupName: {
          type: Sequelize.STRING,
          allowNull: false
        },
        categoryId: {
          type: Sequelize.BIGINT,
          allowNull: false
        },
        createdAt: {
          type: Sequelize.DATE
        },
        updatedAt: {
          type: Sequelize.DATE
        }
      }
    );
  },

  down: function (queryInterface, Sequelize) {
    queryInterface.dropTable('referenceGroupCategory');
  },
};
