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
      defaultValue: false,
    },
    hidden: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    archived: {
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

  Topic.associate = (models) => {
    Topic.hasMany(models.posts, { as: 'posts', foreignKey: 'topicId' });
  };

  Topic.createTopic = (models, topic, reqUserId) => {
    const dbTopic = models.topics.build({
      reference: topic.reference,
      referenceId: topic.referenceId,
      title: topic.title,
      tag: topic.tag,
      hidden: false,
      closed: false,
      archived: false,
      highestPostNumber: 1,
      createdAt: new Date(),
      createdBy: reqUserId,
      updatedAt: new Date(),
      updatedBy: reqUserId,
    });
    return dbTopic.save();
  };

  Topic.findTopics = (models, adapter, {
    filters,
    numberOfPosts = 4,
    fetchDeleted = false,
    raw = false,
    reqUserId,
  }) => {
    const where = filters;
    const postsWhere = {};
    if (!fetchDeleted) {
      where.deletedAt = { [Sequelize.Op.eq]: null };
      postsWhere.deletedAt = { [Sequelize.Op.eq]: null };
    }
    return Topic.findAll({
      where,
      raw,
      include: [{
        model: models.posts,
        as: 'posts',
        order: [['postNumber', 'desc']],
        where: postsWhere,
        limit: numberOfPosts !== -1 ? numberOfPosts : null,
        include: [{
          model: models.post_user_stats,
          as: 'userStats',
          // order: [['postNumber', 'desc']],
          // where: userStatsWhere,
          // limit: numberOfPosts !== -1 ? numberOfPosts : null,
        }],
      }],
    }).then((topics) => {
      const topicIds = topics.map(t => t.id);
      return models.posts.getPostsCount(topicIds)
      .then(topicsPostsCount => adapter.adaptTopics({
        dbTopics: topics,
        topicsPostsCount: topicsPostsCount.map(tpc => tpc.dataValues),
        reqUserId,
      }));
    });
  };

  Topic.findTopic = (models, adapter, { topicId, numberOfPosts = 4, fetchDeleted = false, raw = false, reqUserId }) => {
    const where = { id: topicId };
    const postsWhere = {};
    if (!fetchDeleted) {
      where.deletedAt = { [Sequelize.Op.eq]: null };
      postsWhere.deletedAt = { [Sequelize.Op.eq]: null };
    }
    return Topic.findOne({
      where,
      raw,
      include: [{
        model: models.posts,
        as: 'posts',
        order: [['postNumber', 'desc']],
        where: postsWhere,
        limit: numberOfPosts !== -1 ? numberOfPosts : null,
        include: [{
          model: models.post_user_stats,
          as: 'userStats',
        }],
      }],
    }).then((topic) => {
      if (!topic) return null;
      // console.log(topic, 'topic');
      return models.posts.getTopicPostsCount(topicId)
      .then(totalPosts => adapter.adaptTopic({
        dbTopic: topic,
        totalPosts,
        reqUserId,
      }));
    });
  };

  Topic.updateTopic = (models, adapter, updatedFields, { topicId, reqUserId }) => {
    const where = { id: topicId, deletedAt: { [Sequelize.Op.eq]: null } };
    return models.topics.update(
      Object.assign({}, updatedFields, { updatedBy: reqUserId }),
      {
        where,
        returning: true,
        plain: true,
      })
    .then((result) => {
      console.log('topic updated...');
      // console.log(result);
      return adapter.adaptTopic({
        dbTopic: result[1], // result is [x ,y] : x is number of rows affected, y is actual affected row
        reqUserId,
      });
    });
  };

  return Topic;
};
