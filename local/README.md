# Purpose of this Document

The purpose of this document is to describe how to run and test the messaging service  locally for development purposes.

# Overview

The message service provides apis for members to be able to collaborate within the topcoder platform. It provides capabilities to create public and private threaded conversations associated with specific topcoder entities such as projects, challenges, submissions, etc. and general discussions not associated with any specific entity.

The message service is a thin layer on top of Discourse (https://www.discourse.org). Discourse is an open source forum that provides rich features and a full feature API to handle users, threads, posts, attachments, etc.

The message service provides the following additional services:

* User provisioning: If a user doesn't exist in Discourse, it is automatically created by the service;
* Thread and post creation: Creates threads and posts as needed in Discourse;
* Security: Users may only access public discussions or discussions related to entities to which they have access, the message service handles permissions based on entity access;
* Mapping: Between Discourse entities and topcoder entities;

We will be using docker-compose to stand up all the real and mock up services required to run the messaging service:

1. Discourse: the main backend of the messaging api;
2. Member service mock-up: service to fetch user data in case we need to create a new user in Discourse;
3. Submission service mock-up: service to fetch submissions, which we will use as an example entity to which we will tie threads;
4. Postgres: the main database of the message service, this is used to (1) map between topcoder entities and discourse threads, and (2) to store the endpoint to be used to check if a member has access to a particular entity;
5. Message service: the api that exposes Discourse functionality;

# Pre-Requisites

To prepare your system to run the submission service, please setup the following:

## Docker

We will use Docker for virtualization and so all services run reliably in separate sandboxes, please install docker following the instructions here:

https://docs.docker.com/engine/installation/

## Docker Compose

To help manage multiple docker instances running together, we will use docker compose, you can set it up by following the instructions here:

https://docs.docker.com/compose/install/

## Nodejs and Npm

Install nodejs and npm, instructions can be found here: https://nodejs.org/en/, please use 6.4.x version

## Sequelize cli

Install the sequelize command line interface by following the instructions found here: https://github.com/sequelize/cli



# Local Setup

## Hosts

Update your localhost entry in your hosts file (/etc/hosts or C:\Windows\System32\drivers\etc\hosts on Windows) to map *talk.topcoder-dev.com* and *local.topcoder-dev.com* to the ip address of your docker ip:

```properties
<docker_ip> local.topcoder-dev.com talk.topcoder-dev.com
```
On Linux the docker ip should be 127.0.0.1. On OSX/Windows if you use docker machine, find the docker ip with command ``docker-machine ip``

## Source Code

```shell
git clone https://github.com/topcoder-platform/tc-message-service.git
```

We will refer to this folder henceforth as tc-message-service.

## Setup Discourse

The following describes how to setup Discourse locally:

```shell
# Boot docker container, use 3002 port, you can change to suit your environment
docker pull discourse/discourse_dev:release
docker run -d -p 1080:1080 -p 3002:3002 --hostname=discourse --name=discourse_dev discourse/discourse_dev:release /sbin/boot

# Checkout Discourse source, stable branch
git clone https://github.com/discourse/discourse.git
cd discourse
git checkout stable

# Copy source files to container
docker cp . discourse_dev:/src
docker exec -it discourse_dev /bin/bash -c "chown -R discourse:discourse /src"

# Install bundle and sso plugin
./bin/docker/bundle install
./bin/docker/rake plugin:install["https://github.com/FutureProofGames/discourse_sso_redirect.git"]

# Migrate db
./bin/docker/rake db:migrate

# Create an admin account
./bin/docker/rake admin:create
# Answer the following questions:
#   Email: admin@test.com
#   Password: 1234
#   Repeat password: 1234
#
#   Ensuring account is active!
#
#   Account created successfully with username example
#   Do you want to grant Admin privileges to this account? (Y/n) Y
#
#   Your account now has Admin privileges!

# Get api_key, this will be used later to set env
./bin/docker/rake api_key:get

# Use 3002 port, you can change to suit your environment
./bin/docker/rails s -b 0.0.0.0 -p 3002
```

Note by default the Discourse starts on 3000 port in dev mode, which may conflict with our nodejs app when they both run locally, so we change Discourse to use 3002 port instead.

## Configure Discourse

By default Discourse has some strict validation rules and we can relax them for dev (For example by default Discourse does not allow **mailinator.com** email domain for user). Run following commands(replace  <docker_ip> and <api_key>) to configure Discourse settings:

```shell
curl -X PUT 'http://<docker_ip>:3002/admin/site_settings/email_domains_blacklist?api_key=<api_key>&api_username=system' -H 'content-type: application/x-www-form-urlencoded' -i -d email_domains_blacklist=''

curl -X PUT 'http://<docker_ip>:3002/admin/site_settings/min_post_length?api_key=<api_key>&api_username=system' -H 'content-type: application/x-www-form-urlencoded' -i -d min_post_length=1

curl -X PUT 'http://<docker_ip>:3002/admin/site_settings/min_first_post_length?api_key=<api_key>&api_username=system' -H 'content-type: application/x-www-form-urlencoded' -i -d min_first_post_length=1

curl -X PUT 'http://<docker_ip>:3002/admin/site_settings/min_private_message_post_length?api_key=<api_key>&api_username=system' -H 'content-type: application/x-www-form-urlencoded' -i -d min_private_message_post_length=1

curl -X PUT 'http://<docker_ip>:3002/admin/site_settings/body_min_entropy?api_key=<api_key>&api_username=system' -H 'content-type: application/x-www-form-urlencoded' -i -d body_min_entropy=1

curl -X PUT 'http://<docker_ip>:3002/admin/site_settings/min_topic_title_length?api_key=<api_key>&api_username=system' -H 'content-type: application/x-www-form-urlencoded' -i -d min_topic_title_length=1

curl -X PUT 'http://<docker_ip>:3002/admin/site_settings/title_min_entropy?api_key=<api_key>&api_username=system' -H 'content-type: application/x-www-form-urlencoded' -i -d title_min_entropy=1

curl -X PUT 'http://<docker_ip>:3002/admin/site_settings/allow_uppercase_posts?api_key=<api_key>&api_username=system' -H 'content-type: application/x-www-form-urlencoded' -i -d allow_uppercase_posts=true

curl -X PUT 'http://<docker_ip>:3002/admin/site_settings/min_private_message_title_length?api_key=<api_key>&api_username=system' -H 'content-type: application/x-www-form-urlencoded' -i -d min_private_message_title_length=1

curl -X PUT 'http://<docker_ip>:3002/admin/site_settings/allow_duplicate_topic_titles?api_key=<api_key>&api_username=system' -H 'content-type: application/x-www-form-urlencoded' -i -d allow_duplicate_topic_titles=true

curl -X PUT 'http://<docker_ip>:3002/admin/site_settings/min_title_similar_length?api_key=<api_key>&api_username=system' -H 'content-type: application/x-www-form-urlencoded' -i -d min_title_similar_length=1

curl -X PUT 'http://<docker_ip>:3002/admin/site_settings/min_body_similar_length?api_key=<api_key>&api_username=system' -H 'content-type: application/x-www-form-urlencoded' -i -d min_body_similar_length=1

curl -X PUT 'http://<docker_ip>:3002/admin/site_settings/enable_emoji?api_key=<api_key>&api_username=system' -H 'content-type: application/x-www-form-urlencoded' -i -d enable_emoji=false

```



# Starting the Application

## Running the Dependencies

Go into the tc-message-service/local folder of this repository and start the docker services:

```shell
docker-compose up
```

## Setting up Environment Variables

```shell
export DISCOURSE_API_KEY=<<api_key got from above>>
export DEFAULT_DISCOURSE_PW=supersecretpw
export DISCOURSE_URL=http://talk.topcoder-dev.com:3002
export RABBITMQ_URL=amqp://local.topcoder-dev.com:5672
export DB_MASTER_URL=postgres://coder:mysecretpassword@local.topcoder-dev.com:5432/messages
```

NOTE: 

- The Discourse system user's API key is obtained in the last step from Discourse setup
- DEFAULT_DISCOURSE_PW defines the default password for users which will be created in Discourse automatically
- You may need to change DISCOURSE_URL/RABBITMQ_URL/DB_MASTER_URL if running under differnt host or port

## Install Dependent Packages

In the tc-message-service folder issue the following command:
```shell
npm install
```
Note: npm install only has to be executed the first time when you set up the service, and whenever changes are made to the packages.json file

## Creating the Database Schema

We use sequelize to create and manage the database schema, to create the schema in Postgres, simply go into the tc-message-service folder and issue the following command:

```shell
NODE_ENV=development sequelize db:migrate
```

You can connect to postgres using psql locally or from the postgres docker container:

```properties
user: coder
password: mysecretpassword
database: messages
```

## Running the Service

To run the service in dev mode, go into the tc-message-service folder and issue the following command:

```shell
npm run start:dev
```
This will start service on 8001 port.



# Verify the service

## Setting up Security for Reference Lookups

The message system assumes that if a user has access to an entity at topcoder, they can therefore participate in discussions associated with that entity. The referenceLookup table in Postgres provides a map to determine with API endpoint should be invoked on behalf of the user, by using the user's authentication token, to check if the record is retrievable. If the record is returned, then the user is allowed to view and participate in the discussion.

We are going to use submissions as the entity, and in order to setup the lookup we need to insert a record into the referenceLookup table.

Login to postgres either by install psql locally, or entering the postgres docker container:

```shell
psql messages coder -h local.topcoder-dev.com
```

And execute the following statements:

```sql
INSERT INTO "referenceLookups" (reference, endpoint, "createdAt", "updatedAt") VALUES ('submission', 'http://local.topcoder-dev.com:3001/submissions/{id}', now(), now());
```

## Obtaining a JWT token

JWT is used to authenticate calls to the service, and an unexpired JWT token is required to be passed in the Authorization header for any calls made to the service.

This JWT token can be used to impersonate the user magrathean:

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJtYWdyYXRoZWFuIiwiZXhwIjoxNzY2Mjg5MjQ2LCJ1c2VySWQiOiI0MDAxMTU3OCIsImlhdCI6MTQ1MDkyOTI0NiwiZW1haWwiOm51bGwsImp0aSI6IjEzNjljNjAwLWUwYTEtNDUyNS1hN2M3LTU2YmU3ZDgxM2Y1MSJ9.SeLETowyDVJCGKGc0wjk4fPMH9pug7C9Yw_7xkI7Fvk
```
You can make changes to test with different users by going to [jwt.io](), and pasting the token above in the editor on that page. You can make changes on the "Decoded" side of the editor and that will be reflected in the token that you can then use to sign your requests, therefore impersonating other users.

Note: The signature key used for the local environment is "secret", which is configured in the tc-message-service/config/default.json

## Making a Request

The following curl command will check if the user has access to the submission 455, fetch a thread, creating the thread if necessary, and provisioning a new user in Discourse if necessary:

```shell
curl -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJtYWdyYXRoZWFuIiwiZXhwIjoxNzY2Mjg5MjQ2LCJ1c2VySWQiOiI0MDAxMTU3OCIsImlhdCI6MTQ1MDkyOTI0NiwiZW1haWwiOm51bGwsImp0aSI6IjEzNjljNjAwLWUwYTEtNDUyNS1hN2M3LTU2YmU3ZDgxM2Y1MSJ9.SeLETowyDVJCGKGc0wjk4fPMH9pug7C9Yw_7xkI7Fvk" "http://localhost:8001/v4/topics?filter=reference%3Dsubmission%26referenceId%3D455"
```
You can also create topic by doing the following:
```shell
curl -X POST -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJtYWdyYXRoZWFuIiwiZXhwIjoxNzY2Mjg5MjQ2LCJ1c2VySWQiOiI0MDAxMTU3OCIsImlhdCI6MTQ1MDkyOTI0NiwiZW1haWwiOm51bGwsImp0aSI6IjEzNjljNjAwLWUwYTEtNDUyNS1hN2M3LTU2YmU3ZDgxM2Y1MSJ9.SeLETowyDVJCGKGc0wjk4fPMH9pug7C9Yw_7xkI7Fvk" -H "Content-Type: application/json" "http://localhost:8001/v4/topics" -d '{"reference":"submission","referenceId":"455","tag":"MESSAGES","title":"Test discussion topic","body":"Create a new topic for the specified entity"}'
```


## Unit tests

Please update test environment configurations in `config/config.json`.

```shell
NODE_ENV=test sequelize db:migrate
npm test
```

Then you can check coverage report in coverage folder.

## Postman

You can also verify the service using Postman. For this load files from the local/postman directory into Postman.

# Enable Discourse SSO

Here are the steps that you can follow to enable the Discourse sso:

The `config/default.json` file contains the following sso related properties:

- discourseSSO
  - secret - the discourse sso secret, need to be the same as the value on discouse settings page
  - loginCookieName - the login cookie name to obtain the jwt token
  - loginUrl - the login url to redirect to

To enable sso in Discourse, login into Discourse with the admin account created above.
Click on the menu icon (top right corner) and select Admin.
Click on the Settings tab and then on the Login menu item
Scroll down and do as below:

- activate 'enable sso',
- activate 'sso overrides email'
- activate 'sso overrides username'
- activate 'sso overrides name'
- set 'sso url' to the sso endpoint of this message service. e.g. http://localhost:8001/sso
- set 'sso secret' to the same value as the `discourseSSO.secret` in the `config/default.json` file, e.g. secret12345

Still on the settings tab, click the 'Users' menu and set 'logout redirect' to a logout endpoint http://localhost:8001
Still on the settings tab, click the 'SSO Redirect' menu and add host of sso-url to the 'sso redirect domain whitelist'

Note that the 'SSO Redirect' menu appeared after restarting the docker container.