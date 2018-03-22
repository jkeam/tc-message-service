'use strict';
module.exports = {
  up: function(queryInterface, Sequelize) {
    return [
      queryInterface.createTable('posts', {
        id: {
          type: Sequelize.BIGINT,
          primaryKey: true,
          autoIncrement: true,
        },
        // content of the post
        raw: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        // topic id
        topicId: {
          type: Sequelize.BIGINT,
          allowNull: false,
        },
        postNumber: {
          type: Sequelize.INTEGER,
        },
        reads: {
          type: Sequelize.INTEGER,
        },
        viaEmail: {
          type: Sequelize.BOOLEAN,
        },
        rawEmail: {
          type: Sequelize.STRING,
        },
        hidden: {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        },
        hiddenReason: {
          type: Sequelize.STRING,
        },
        // When was this record created
        createdAt: {
          type: Sequelize.DATE,
        },
        // Who created this record
        createdBy: {
          type: Sequelize.STRING,
        },
        // When was this record last updated
        updatedAt: {
          type: Sequelize.DATE,
        },
        // Who last updated this record
        updatedBy: {
          type: Sequelize.STRING,
        },
        // When was this record deleted
        deletedAt: {
          type: Sequelize.DATE,
        },
        // Who deleted this record
        deletedBy: {
          type: Sequelize.STRING,
        },
      }),
      queryInterface.createTable('post_user_stats', {
        // The primary key
        postId: {
          type: Sequelize.BIGINT,
          primaryKey: true,
        },
        action: {
          type: Sequelize.STRING,
          allowNull: false,
          primaryKey: true,
        },
        userIds: {
          type: Sequelize.ARRAY(Sequelize.STRING),
        },
        // topic id
        topicId: {
          type: Sequelize.BIGINT,
          allowNull: false,
        },
      }),
      queryInterface.addColumn(
        'topics',
        'title',
        {
          type: Sequelize.STRING,
          allowNull: false,
        }
      ),
      queryInterface.addColumn(
        'topics',
        'highestPostNumber',
        {
          type: Sequelize.INTEGER,
        }
      ),
      queryInterface.addColumn(
        'topics',
        'closed',
        {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        }
      ),
      queryInterface.addColumn(
        'topics',
        'hidden',
        {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        }
      ),
      queryInterface.addColumn(
        'topics',
        'archived',
        {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
        }
      ),
      queryInterface.addColumn(
        'topics',
        'hiddenReason',
        {
          type: Sequelize.STRING
        }
      ),
      queryInterface.changeColumn(
        'topics',
        'discourseTopicId',
        {
          type: Sequelize.BIGINT,
          allowNull: true,
        }
      )
    ]
  },
  down: function(queryInterface, Sequelize) {
    return [
      queryInterface.dropTable('posts'),
      queryInterface.dropTable('post_user_stats'),
      queryInterface.removeColumn('topics', 'title'),
      queryInterface.removeColumn('topics', 'highestPostNumber'),
      queryInterface.removeColumn('topics', 'closed'),
      queryInterface.removeColumn('topics', 'hidden'),
      queryInterface.removeColumn('topics', 'archived'),
      queryInterface.removeColumn('topics', 'hiddenReason'),
      queryInterface.changeColumn(
        'topics',
        'discourseTopicId',
        {
          type: Sequelize.BIGINT,
          allowNull: false,
        }
      ),
    ];
  }
};
