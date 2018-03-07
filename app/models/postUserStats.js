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
  const PostUserStats = Sequelize.define('post_user_stats_backup', {
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
    // postNumber: {
    //   type: DataTypes.INTEGER,
    // },
  }, {
    freezeTableName : true,
    timestamps: false,
  });

  PostUserStats.createStats = (models, logger, { post, userId, action }) => {
    return PostUserStats.build({
      postId: post.id,
      topicId: post.topicId,
      userIds: [userId],
      action
    }).save();
  }

  /**
   * Updates user stats for all given posts for the given user
   *
   * @param models {Object} Sequelize database models
   * @param logger {Object} logger object used for logging
   * @param posts  {Array} array posts for which stats are to be updated
   * @param userId {String} id of the user who performed action on these posts
   * @param action {String} action performed for which stats are to be updated
   *
   * @return {Promise} promise for update operation
   */
  PostUserStats.updateUserStats = (models, logger, posts, userId, action) => {
    const postIds = posts.map(p => p.id).join(',');
    return Sequelize.query('UPDATE post_user_stats_backup SET "userIds"=array_append("userIds", \''
      + userId + '\') WHERE "postId" IN (' + postIds + ')'
      + ' AND action=\'' + action + '\' AND NOT("userIds" @> ARRAY[\'' + userId +'\']::varchar[])')
    .then((resp) => {
      logger.debug(`Updated ${resp[1].rowCount} post_user_stats for the user: `);
    });
  }

  PostUserStats.findPostsWithoutUserAction = (models, logger, posts, userId, action) => {
    const postIds = posts.map(p => p.id).join(',');
    return Sequelize.query('SELECT pus."postId" as id FROM post_user_stats_backup pus'
      + ' WHERE "postId" IN (' + postIds + ')'
      + ' AND action=\'' + action + '\' AND NOT("userIds" @> ARRAY[\'' + userId +'\']::varchar[])')
    .then((resp) => {
      logger.debug("response");
      return _.get(resp, '[1].rows', []);
      // logger.debug(`Updated ${resp[1].rowCount} post_user_stats for the user: `);
    });
  }

  return PostUserStats;
};
