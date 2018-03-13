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
      defaultValue: false,
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
    freezeTableName: true,
  });

  Post.associate = (models) => {
    Post.hasMany(models.post_user_stats_backup, { as: 'userStats', foreignKey: 'postId' });
  };

  Post.createPost = (models, postBody, topic, reqUserId) => {
    const post = models.posts_backup.build({
      topicId: topic.id,
      raw: postBody,
      postNumber: topic.highestPostNumber + 1,
      viaEmail: false,
      hidden: false,
      reads: 0,
      createdAt: new Date(),
      createdBy: reqUserId,
      updatedAt: new Date(),
      updatedBy: reqUserId,
    });
    return post.save();
  };

  Post.getTopicPostsCount = (topicId, countDeleted = false) => {
    const where = { topicId };
    if (!countDeleted) {
      where.deletedAt = { [Sequelize.Op.eq]: null };
    }
    return Post.count({
      where,
    });
  };

  Post.getPostsCount = (topicIds, countDeleted = false) => {
    const where = { topicId: { [Sequelize.Op.in]: topicIds } };
    if (!countDeleted) {
      where.deletedAt = { [Sequelize.Op.eq]: null };
    }
    return Post.findAll({
      where,
      attributes: ['topicId', [Sequelize.fn('COUNT', Sequelize.col('id')), 'totalPosts']],
      group: ['topicId'],
    });
  };

  Post.findPosts = (adapter, filters, fetchDeleted = false) => {
    const where = filters;
    if (!fetchDeleted) {
      where.deletedAt = { [Sequelize.Op.eq]: null };
    }
    return Post.findAll({
      where,
    }).then((posts) => {
      if (!posts || posts.length === 0) return null;
      return adapter.adaptPosts(posts);
    });
  };

  Post.findPost = (adapter, topicId, postId, fetchDeleted = false) => {
    const where = { id: postId, topicId };
    if (!fetchDeleted) {
      where.deletedAt = { [Sequelize.Op.eq]: null };
    }
    return Post.findOne({
      where,
    }).then((post) => {
      if (!post) return null;
      return adapter.adaptPost(post);
    });
  };

  /**
   * Increases the read count of the give post(s) for the given user.
   *
   * @param {Object} models Sequelize database models
   * @param {Object} logger logger object used for logging
   * @param{Array} posts array posts for which read count is to be increased
   *
   * @return {Promise} promise for update operation
   */
  Post.increaseReadCount = (models, logger, posts) => { /* eslint no-param-reassign: ["error", { "props": true, "ignorePropertyModificationsFor": ["posts"] }] */
    if (!posts || posts.length === 0) return Promise.resolve();
    for (let i = 0; i < posts.length; i++) {
      posts[i].reads += 1;
    }
    const postIds = posts.map(p => p.id).join(',');
    return Sequelize.query(`UPDATE posts_backup set reads=reads+1 where id IN (${postIds})`)
    .then((resp) => {
      logger.debug(`Updated ${resp[1].rowCount} posts to increase the read count`);
    });
  };
  return Post;
};
