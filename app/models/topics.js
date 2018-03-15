'user strict';

/**
 * Represents a mapping between a Discourse topic and a
 * topcoder entity such as project, challenge, or submission
 */
/**
 * Represents a mapping between a Discourse topic and a
 * topcoder entity such as project, challenge, or submission
 * @param  {Object} Sequelize sequelize object
 * @param  {Object} DataTypes sequelize data types
 * @return {void}
 */
module.exports = (Sequelize, DataTypes) => {
    // Topics represents the data that links topcoder entities with discourse topics
  const Topic = Sequelize.define('topics', {
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
    discourseTopicId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true,
    },
        // A tag for filtering
    tag: {
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

    // temporary field to mark topics which are managed in an old way using private messages
    // instead of the new way using groups and categories
    isPrivateMessage: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  });

  return Topic;
};
