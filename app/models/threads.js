'user strict' 

module.exports = (Sequelize, DataTypes) => {
    // Threads represents the data that links topcoder entities with discourse threads 
    var Thread = Sequelize.define('threads', {
        id: {  
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true
        },
        reference: {  
            type: DataTypes.STRING,
            allowNull: false
        },
        referenceId: {  
            type: DataTypes.STRING,
            allowNull: false
        },
        discourseThreadId: {  
            type: DataTypes.BIGINT,
            allowNull: false
        },
        tag: {  
            type: DataTypes.STRING
        },
        createdAt: {
            type: DataTypes.DATE
        },
        createdBy: {
            type: DataTypes.STRING
        },
        updatedAt: {
            type: DataTypes.DATE
        },
        updatedBy: {
            type: DataTypes.STRING
        }
    });

    return Thread;
}

