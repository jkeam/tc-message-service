
# Data Models in  tc-message-service

## Specific features from postgres used

1. Array as data type for post_user_stats#userIds
2. array_append method called when updating userIds in post_user_stats model
3. model.update method resolves with [x, y] where x is the number of rows affected while y is the actual row affected
