'user strict' 

/**
 * Represents a mapping between a Discourse topic and a 
 * topcoder entity such as project, challenge, or submission
 */
module.exports = (Sequelize, DataTypes) => {
    // Topics represents the data that links topcoder entities with discourse topics 
    var Topic = Sequelize.define('topics', {
        // The primary key
        id: {  
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        // The name of the reference, such as challenge, project, or submission
        reference: {  
            type: DataTypes.STRING,
            allowNull: false
        },
        // The identfier of the reference
        referenceId: {  
            type: DataTypes.STRING,
            allowNull: false
        },
        // The id of the Discourse topic
        discourseTopicId: {  
            type: DataTypes.BIGINT,
            allowNull: false,
            unique: true
        },
        // A tag for filtering
        tag: {  
            type: DataTypes.STRING
        },
        // When was this record created
        createdAt: {
            type: DataTypes.DATE
        },
        // Who created this record
        createdBy: {
            type: DataTypes.STRING
        },
        // When was this record last updated
        updatedAt: {
            type: DataTypes.DATE
        },
        // Who last updated this record
        updatedBy: {
            type: DataTypes.STRING
        }
    });

    return Topic;
}

