'use strict';

module.exports = {
  up: function (queryInterface, Sequelize) {
    queryInterface.createTable(
        'topics',
        {
            id: {  
                type: Sequelize.BIGINT,
                primaryKey: true,
                autoIncrement: true
            },
            reference: {  
                type: Sequelize.STRING,
                allowNull: false
            },
            referenceId: {  
                type: Sequelize.STRING,
                allowNull: false
            },
            discourseTopicId: {  
                type: Sequelize.BIGINT,
                allowNull: false
            },
            tag: {  
                type: Sequelize.STRING
            },
            createdAt: {
                type: Sequelize.DATE
            },
            createdBy: {
                type: Sequelize.STRING
            },
            updatedAt: {
                type: Sequelize.DATE
            },
            updatedBy: {
                type: Sequelize.STRING
            }
        }
    );

    queryInterface.createTable(
        'referenceLookups',
        {
            reference: {  
                type: Sequelize.STRING,
                primaryKey: true
            },
            endpoint: {  
                type: Sequelize.STRING,
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
    queryInterface.dropTable('topics');
    queryInterface.dropTable('referenceLookups');
  }
};
