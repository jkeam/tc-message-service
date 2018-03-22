'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return queryInterface.createTable('post_attachments', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.BIGINT
      },
      postId: {
        allowNull: false,
        type: Sequelize.BIGINT
      },
      originalFileName: {
        allowNull: false,
        type: Sequelize.STRING(512)
      },
      fileSize: {
        allowNull: false,
        type: Sequelize.INTEGER
      },
      sha1: {
        allowNull: false,
        type: Sequelize.STRING(40)
      },
      url: {
        allowNull: false,
        type: Sequelize.STRING
      },
      createdBy: {
        allowNull: false,
        type: Sequelize.STRING
      },
      updatedBy: {
        allowNull: false,
        type: Sequelize.STRING
      },
      deletedBy: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      deletedAt: {
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: function(queryInterface, Sequelize) {
    return queryInterface.dropTable('post_attachments');
  }
};
