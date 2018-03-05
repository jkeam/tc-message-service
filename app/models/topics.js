'user strict';


/**
 * Represents a topic and a topcoder entity such as project, challenge, or submission
 */
/**
 * Represents a topic and a topcoder entity such as project, challenge, or submission
 * @param  {Object} Sequelize sequelize object
 * @param  {Object} DataTypes sequelize data types
 * @return {void}
 */
module.exports = (Sequelize, DataTypes) => {
  // Topics represents the data that links topcoder entities with topics
  const Topic = Sequelize.define('topics_backup', {
        // The primary key
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    // The name of the reference, such as challenge, project, or submission
    reference: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // The identfier of the reference
    referenceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // The id of the Discourse topic
    // DEPRICATED, only exists for backward compatability
    discourseTopicId: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    // A tag for filtering
    tag: {
      type: DataTypes.STRING,
    },
    title: {
      type: DataTypes.STRING,
    },
    highestPostNumber: {
      type: DataTypes.INTEGER,
    },
    closed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    hidden: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    archived: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    hiddenReason: {
      type: DataTypes.STRING,
    },
    // When was this record created
    createdAt: {
      type: DataTypes.DATE,
    },
        // Who created this record
    createdBy: {
      type: DataTypes.STRING,
    },
        // When was this record last updated
    updatedAt: {
      type: DataTypes.DATE,
    },
        // Who last updated this record
    updatedBy: {
      type: DataTypes.STRING,
    },
    // When was this record deleted
    deletedAt: {
      type: DataTypes.DATE,
    },
    // Who deleted this record
    deletedBy: {
      type: DataTypes.STRING,
    },
  }, {
    freezeTableName : true,
  });

  Topic.associate = (models) => {
    Topic.hasMany(models.posts_backup, { as: 'posts', foreignKey: 'topicId' });
  };

  Topic.findTopics = (models, filters, numberOfPosts = 3, fetchedDeleted = false) => {
    return Topic.findAll({
      where: Object.assign({}, filters, { deletedAt : { [Sequelize.Op.eq]: null } }),
      raw: false,
      include: [{
        model: models.posts_backup,
        as: "posts",
        order: [["postNumber", "desc"]],
        where: { deletedAt : { [Sequelize.Op.eq]: null } },
        limit: numberOfPosts
      }] 
    })
  }

  Topic.findTopic = (models, topicId, numberOfPosts = 3, fetchedDeleted = false) => {
    return Topic.findOne({
      where: { id: topicId, deletedAt : { [Sequelize.Op.eq]: null } },
      raw: false,
      include: [{
        model: models.posts_backup,
        as: "posts",
        order: [["postNumber", "desc"]],
        where: { deletedAt : { [Sequelize.Op.eq]: null } },
        limit: numberOfPosts
      }] 
    })
  }

  return Topic;
};
