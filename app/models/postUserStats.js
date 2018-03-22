'user strict';

import _ from 'lodash';

/**
 * Represents statistics of a post for single user.
 */
/**
 * Represents statistics of a post for single user.
 * @param  {Object} Sequelize sequelize object
 * @param  {Object} DataTypes sequelize data types
 * @return {void}
 */
module.exports = (Sequelize, DataTypes) => {
    // PostUserStats
  const PostUserStats = Sequelize.define('post_user_stats', {
    // The primary key
    postId: {
      type: DataTypes.BIGINT,
      primaryKey: true,
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
    },
    userIds: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      //type: DataTypes.JSONB, // [{id: 22688955, lastPerformed: 1519819061, channel: 'API/Slack/Email', method: 'list/push/click'}]
    },
    // topic id
    topicId: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
  }, {
    freezeTableName: true,
    timestamps: false,
  });

  PostUserStats.createStats = (models, logger, { post, userId, action }) => {
    logger.debug('Saving PostUserStats');
    return PostUserStats.build({
      postId: post.id,
      topicId: post.topicId,
      userIds: [userId],
      action,
    }).save();
  };

  /**
   * Updates user stats for all given posts for the given user
   *
   * @param {Object} models Sequelize database models
   * @param {Object} logger logger object used for logging
   * @param {Array} posts array posts for which stats are to be updated
   * @param {String} userId id of the user who performed action on these posts
   * @param {String} action action performed for which stats are to be updated
   *
   * @return {Promise} promise for update operation
   */
  PostUserStats.updateUserStats = (models, logger, posts, userId, action) => {
    const postIds = posts.map(p => p.id).join(',');
    return Sequelize.query(`UPDATE post_user_stats SET "userIds"=array_append("userIds", '${userId}')
      WHERE "postId" IN (${postIds}) AND action='${action}' AND NOT("userIds" @> ARRAY[${userId}]::varchar[])`)
    .then((resp) => {
      logger.debug(`Updated ${resp[1].rowCount} post_user_stats for the user: `);
    });
  };

  PostUserStats.findPostsWithoutUserAction = (models, logger, posts, userId, action) => {
    const postIds = posts.map(p => p.id).join(',');
    return Sequelize.query(`SELECT pus."postId" as id FROM post_user_stats pus
        WHERE "postId" IN (${postIds})
        AND action=${action} AND NOT("userIds" @> ARRAY[${userId}]::varchar[])`)
    .then((resp) => {
      logger.debug(`Found ${resp[1].rowCount} post_user_stats for the user: `);
      return _.get(resp, '[1].rows', []);
    });
  };

  return PostUserStats;
};
