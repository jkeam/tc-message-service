'user strict';

/**
 * Represents a post under a topic.
 */
/**
 * Represents a post under a topic.
 * @param  {Object} Sequelize sequelize object
 * @param  {Object} DataTypes sequelize data types
 * @return {void}
 */
module.exports = (Sequelize, DataTypes) => {
    // Posts
  const Post = Sequelize.define('posts_backup', {
    // The primary key
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    // content of the post
    raw: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // topic id
    topicId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    postNumber: {
      type: DataTypes.INTEGER,
    },
    reads: {
      type: DataTypes.INTEGER,
    },
    viaEmail: {
      type: DataTypes.BOOLEAN,
    },
    rawEmail: {
      type: DataTypes.STRING,
    },
    hidden: {
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
    freezeTableName : true
  });

  Post.getPostsCount = (topicId, countDeleted = false) => {
    return Post.count({
      where : { topicId: topicId, deletedAt : { [Sequelize.Op.eq]: null } }
    });
  }

  Post.findPosts = (filters, fetchDeleted = false) => {
    return Post.findAll({
      where: Object.assign({}, filters, { deletedAt : { [Sequelize.Op.eq]: null } })
    });
  }

  Post.findPost = (topicId, postId, fetchDeleted = false) => {
    return Post.findOne({
      where: { id: postId, topicId: topicId, deletedAt : { [Sequelize.Op.eq]: null } }
    });
  }

  /**
   * Increases the read count of the give post(s) for the given user.
   *
   * @param models {Object} Sequelize database models
   * @param logger {Object} logger object used for logging
   * @param posts  {Array} array posts for which read count is to be increased
   * @param userId {String} id of the user who read these posts
   *
   * @return {Promise} promise for update operation
   */
  Post.increaseReadCount = (models, logger, posts, userId) => {
    if (!posts || posts.length == 0) return Promise.resolve();
    posts.map(p => p.reads++);
    const postIds = posts.map(p => p.id).join(',');
    return Sequelize.query('UPDATE posts_backup set reads=reads+1 where id IN (' + postIds + ')')
    .then((resp) => {
      logger.debug(`Updated ${resp[1].rowCount} posts to increase the read count`);
    });
  }
  return Post;
};
