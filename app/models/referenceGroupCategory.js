'user strict';

/**
 * ReferenceGroupCategory model
 *
 * Keep references between entities (reference + referenceId)
 * and Discourse group + Discourse category
 * @param  {Object} Sequelize sequelize object
 * @param  {Object} DataTypes sequelize data types
 * @return {void}
 */
module.exports = (Sequelize, DataTypes) => {
  const ReferenceGroupCategory = Sequelize.define('referenceGroupCategory', {
    // The primary key
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    // The name of the reference, such as challenge, project, or submission
    reference: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // The identifier of the reference
    referenceId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // The id of the Discourse group
    groupId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true,
    },
    // The name of the Discourse group,
    // need it because some Discourse API endpoints use it instead of id
    groupName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    // The id of the Discourse category
    categoryId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true,
    },
  }, {
    // disable the modification of tablenames; By default, sequelize will automatically
    // transform all passed model names (first parameter of define) into plural.
    // if you don't want that, set the following
    freezeTableName: true,
  });

  return ReferenceGroupCategory;
};
