'use strict' 

module.exports = (Sequelize, DataTypes) => {
    // Reference lookup represents the api endpoint that should be used to lookup the record
    // in order to determine if the user has access to the given entity
    var ReferenceLookup = Sequelize.define('referenceLookups', {
        reference: {  
            type: DataTypes.STRING,
            primaryKey: true
        },
        endpoint: {  
            type: DataTypes.STRING,
            allowNull: false
        }
    });

    return ReferenceLookup;
}

