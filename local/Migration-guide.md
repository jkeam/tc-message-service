# Migration guide

Migration from handling messages in Discourse with private message to categories and groups.

## Migration steps

### Backup DBs
  - Backup `tc-message-service` DB:<br>
    `pg_dump -d messages -U coder -h 0.0.0.0 > messages_backup.psql`
  - Backup `Discourse` DB:<br>
    `docker exec -it -u postgres discourse_dev /bin/bash -c "pg_dump -d discourse_development > /src/discourse_backup.psql"`

### Migrate DB for `tc-message-service`:
  - `NODE_ENV=development sequelize db:migrate`
  - `NODE_ENV=test sequelize db:migrate`

### Run `tc-message-service`
When `tc-message-service` starts, it will run migration process with the next workflow:
 - get all projects in message-service DB to estimate total time
 - find project which has non-migrated topics
   - get list of topics from message-service
   - get list of project members from TC API v4
   - create group with users using Discourse API
   - create category with permissions only for the group using Discourse API
   - convert topics from private messages to public using Discourse API
   - add topics to created category using Discourse API
   - Note: users permissions for topics are stayed untouched as they don't make any difference
 - stop when we cannot find a project with non-migrated topics

### Control migration

There are two endpoints to see migration state of `tc-message-service`:
- `/migrate-to-groups/log` - shows migration logs
- `/migrate-to-groups/time` - show migration time statistics and estimations

### After successful migration (optional)
- Remove script `migrate-to-groups` from `package.json`
- Remove start migration code from `index.js`
- Remove `app/migrate-to-groups.js`
- Write migration to remove `isPrivateMessage` from `topics` model
- Remove old syncing code from `app/routes/topics/syncUsers.js`
- Remove subquery to get `allowed_users` in the Discourse data-explorer plugin in query `Connect_Topics_Query`

### Restore backups (optional)

Locally I restore backups using next commands.
  - Restore `tc-message-service` DB:<br>
    - `PGPASSWORD=mysecretpassword psql postgres -U coder -h 0.0.0.0 -c "drop database messages"`
    - `PGPASSWORD=mysecretpassword psql postgres -U coder -h 0.0.0.0 -c "create database messages"`
    - `PGPASSWORD=mysecretpassword psql -d messages -U coder -h 0.0.0.0 < messages_backup.psql`
  - Restore `Discourse` DB:<br>
    - `docker exec -it -u postgres discourse_dev /bin/bash -c "psql -c \"drop database discourse_development\""`
    - `docker exec -it -u postgres discourse_dev /bin/bash -c "psql -c \"create database discourse_development\""`
    - `docker exec -it -u postgres discourse_dev /bin/bash -c "psql discourse_development < /src/discourse_backup.psql"`

