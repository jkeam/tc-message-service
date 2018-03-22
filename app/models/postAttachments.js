'user strict';

/**
 * @param  {Object} Sequelize sequelize object
 * @param  {Object} DataTypes sequelize data types
 * @return {void}
 */
module.exports = (Sequelize, DataTypes) =>
  // This table represents uploads made sent by users
  Sequelize.define('post_attachments', {
    // The primary key
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    // The post id
    postId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    // The original file name
    originalFileName: {
      type: DataTypes.STRING(512),
      allowNull: false,
    },
    // The file size
    fileSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    // The sha1 checksum
    sha1: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    // The unsigned S3 resource URL
    url: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // The sender of this attachment
    createdBy: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Who updated this attachment, filled when created as well
    updatedBy: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // When this attachment was deleted
    deletedAt: {
      type: DataTypes.DATE,
    },
    // Who deleted this attachment
    deletedBy: {
      type: DataTypes.STRING,
    },
  });
