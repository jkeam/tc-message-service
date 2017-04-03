

/**
 * Represents an api lookup used to verify if a user has access to a given entity
 */

module.exports = (Sequelize, DataTypes) => {
    // Reference lookup represents the api endpoint that should be used to lookup the record
    // in order to determine if the user has access to the given entity
  const ReferenceLookup = Sequelize.define('referenceLookups', {
    reference: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    endpoint: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  return ReferenceLookup;
};

