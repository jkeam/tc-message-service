'use strict';
module.exports = {
  up: function (queryInterface, Sequelize) {
    queryInterface.createTable(
        'emailLogs',
        {
            id: {
              type: Sequelize.BIGINT,
              primaryKey: true,
              autoIncrement: true,
            },
            fromAddress: {
              type: Sequelize.STRING,
              allowNull: false,
            },
            toAddress: {
              type: Sequelize.STRING(500),
              allowNull: false,
            },
            ccAddresses: {
              type: Sequelize.STRING,
              allowNull: false,
            },
            subject: {
              type: Sequelize.STRING,
              allowNull: false,
            },
            createdAt: {
              type: Sequelize.DATE,
            },
            updatedAt: {
              type: Sequelize.DATE,
            },  
            rawText: {
              type: Sequelize.TEXT,
              allowNull: false,
            },
            userId: {
              type: Sequelize.BIGINT,
              allowNull: false,
            },
            topicId: {
              type: Sequelize.BIGINT,
              allowNull: false,
            },
            postId: {
              type: Sequelize.BIGINT,
              allowNull: false,
            },
            token: {
              type: Sequelize.STRING(500),
              allowNull: false,
            },
            status: {
              type: Sequelize.STRING,
              allowNull: false,
            }
        }
    );
  },
  down: function (queryInterface, Sequelize) {
    queryInterface.dropTable('emailLogs');
  }
};