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

## Discourse

The following page describes how to install and setup a Discourse instance. It suggest the use of a cloud server, but this setup can be easily done locally as well. Feel free to use either approach, just make sure to set the appropriate hosts entries, since this guide assumes you will be running Discourse locally.

If you setup Discourse locally, use talk.topcoder.com as a hostname for Discourse.

Also, the setup requires an email server, you can use your own SMTP server running locally or any cloud service such as SendGrid which has a free tier, GMail, etc.

Discourse setup: https://github.com/discourse/discourse/blob/master/docs/INSTALL-cloud.md

If you have problems with deploying Discourse on OS X, note that you need to change /var to /private/var in app.yml and need to set read&write permissions for /private/var/discourse/shared.
If error happens, can restart with ./launcher bootstrap app.

Next you will need to establish an admin account. You can do that by registering an account with the same email you provided in the Discourse setup, or alternatively use the discourse command line tools as described here:

https://meta.discourse.org/t/create-admin-account-from-console/17274

## Nodejs and Npm

Install nodejs and npm, instructions can be found here: https://nodejs.org/en/, please use 6.4.x version

## Sequelize cli

Install the sequelize command line interface by following the instructions found here: https://github.com/sequelize/cli

# Local Setup

## Hosts

Update your localhost entry in your hosts file (/etc/hosts) to map talk.topcoder.com and local.topcoder-dev.com to the ip address in which your docker containers will run:
On Linux it is the local host itself:
```
127.0.0.1	localhost local.topcoder-dev.com talk.topcoder.com talk.topcoder-dev.com
```
On Windows it is the ip address of the docker machine, find it with the command "docker-machine ip", below is the default:
C:\Windows\System32\drivers\etc\hosts
```
192.168.99.100	local.topcoder-dev.com talk.topcoder.com talk.topcoder-dev.com
```
On Mac OS X it is the ip address of the docker virtual machine, find it with the command "docker-machine ip", below is the default
/etc/hosts
```
192.168.99.100	 local.topcoder-dev.com talk.topcoder.com talk.topcoder-dev.com
```
If docker runs no machine, then map to 127.0.0.1 as on Linux.

We will use talk.topcoder.com to access Discourse, and local.topcoder-dev.com to access all other services and database.

## Source Code

Unzip the zip file with the source code for the message service locally, we will refer to this folder henceforth as tc-message-service.

# Starting the Application

## Running the Dependencies

Go into the tc-message-service/local folder of this repository and start the docker services:

```
docker-compose up
```

## Install Dependent Packages

In the tc-message-service folder issue the following command:
```
npm install
```
Note: npm install only has to be executed the first time when you set up the service, and whenever changes are made to the packages.json file

## Creating the Database Schema

We use sequelize to create and manage the database schema, to create the schema in Postgres, simply go into the tc-message-service folder and issue the following command:

```
sequelize db:migrate
```

You can connect to postgres using psql locally or from the postgres docker container:

```
user: postgres
password: postgres
database: messages
```

## Setting up Security for Reference Lookups

The message system assumes that if a user has access to an entity at topcoder, they can therefore participate in discussions associated with that entity. The referenceLookup table in Postgres provides a map to determine with API endpoint should be invoked on behalf of the user, by using the user's authentication token, to check if the record is retrievable. If the record is returned, then the user is allowed to view and participate in the discussion.

We are going to use submissions as the entity, and in order to setup the lookup we need to insert a record into the referenceLookup table.

Login to postgres either by install psql locally, or entering the postgres container:

```
psql messages postgres -h local.topcoder-dev.com
```

And execute the following statement:

```
insert into "referenceLookups" (reference, endpoint, "createdAt", "updatedAt") values ('submission', 'http://local.topcoder-dev.com:3001/submissions/{id}', now(), now());
```

## Setup Discourse and Enable SSO
Here are the commands that you can follow to setup the discourse and enable sso:
```
# setup
sudo -s
mkdir /var/discourse
git clone https://github.com/discourse/discourse_docker.git /var/discourse
cd /var/discourse
./discourse-setup

# Answer the following questions when prompted:
#   Hostname for your Discourse? [discourse.example.com]: localhost
#   Email address for admin account? [me@example.com]: myname@gmail.com
#   SMTP server address? [smtp.example.com]: smtp.gmail.com
#   SMTP user name? [postmaster@discourse.example.com]: myname@gmail.com
#   SMTP port [587]: 587
#   SMTP password? []: mygmailpassword
# This will generate an app.yml configuration file on your behalf, and then kicks off bootstrap.
# Bootstrapping takes between 2-8 minutes to set up your Discourse.

sudo /var/discourse/launcher enter app

# install sso plugin
rake plugin:install["https://github.com/FutureProofGames/discourse_sso_redirect.git"]

# create admin acount
rake admin:create

# answer the following questions:
#   Email: admin@example.com
#   Password: password
#   Repeat password: password
#
#   Ensuring account is active!
#
#   Account created successfully with username example
#   Do you want to grant Admin privileges to this account? (Y/n) Y
#
#   Your account now has Admin privileges!

# get an api key
rake api_key:get

The `config/default.json` file contains the following discourse and sso related properties:
* discourseURL - this is the disource host url, no need to change.
* discourseApiKey - this is the discourse api key, set to the api-key obtained above.
* discourseSSO
** secret - the discourse sso secret, need to be the same as the value on discouse settings page
** loginCookieName - the login cookie name to obtain the jwt token
** loginUrl - the login url to redirect to

To enable sso in discourse, login discourse with the admin account created above.
Click on the menu icon (top right corner) and select Admin.
Click on the Settings tab and then on the Login menu item
Scroll down and do as below:
* activate 'enable sso',
* activate 'sso overrides email'
* activate 'sso overrides username'
* activate 'sso overrides name'
* set 'sso url' to the sso endpoint of this message service. e.g. http://127.0.0.1:3000/sso
* set 'sso secret' to the same value as the `discourseSSO.secret` in the `config/default.json` file, e.g. secret12345

Still on the settings tab, click the 'Users' menu and set 'logout redirect' to a logout endpoint.
Still on the settings tab, click the 'SSO Redirect' menu and add host of sso-url to the 'sso redirect domain whitelist'

Note that the 'SSO Redirect' menu appeared after restarting the docker container in /var/discourse directory:
```
sudo ./launcher stop app
sudo ./launcher start app
```

## Setting up Environment Variables

We need to set the following 2 environment variables:

```
export DISCOURSE_API_KEY=<<SYSTEM USER API KEY>>
export DEFAULT_DISCOURSE_PW=supersecretpw
```

DEFAULT_DISCOURSE_PW defines the default password for users which will be created in Discourse automatically.
The system user's API key is obtained in the last step from discourse.

# Running the Service

To run the service, go into the tc-message-service folder and issue the following command:

```
npm start
```

To see pretty logging on local development use the following command instead:
```
npm run local-start
```

# Testing the service

## Obtaining a JWT token

JWT is used to authenticate calls to the service, and an unexpired JWT token is required to be passed in the Authorization header for any calls made to the service.

This JWT token can be used to impersonate the user magrathean:

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJtYWdyYXRoZWFuIiwiZXhwIjoxNzY2Mjg5MjQ2LCJ1c2VySWQiOiI0MDAxMTU3OCIsImlhdCI6MTQ1MDkyOTI0NiwiZW1haWwiOm51bGwsImp0aSI6IjEzNjljNjAwLWUwYTEtNDUyNS1hN2M3LTU2YmU3ZDgxM2Y1MSJ9.SeLETowyDVJCGKGc0wjk4fPMH9pug7C9Yw_7xkI7Fvk
```

You can make changes to test with different users by going to jwt.io, and pasting the token above in the editor on that page. You can make changes on the "Decoded" side of the editor and that will be reflected in the token that you can then use to sign your requests, therefore impersonating other users.

Note: The signature key used for the local environment is "secret", which is configured in the tc-message-service/config/default.json

## Making a Request

The following curl command will check if the user has access to the submission 455, fetch a thread, creating the thread if necessary, and provisioning a new user in discourse if necessary:

```
curl -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJtYWdyYXRoZWFuIiwiZXhwIjoxNzY2Mjg5MjQ2LCJ1c2VySWQiOiI0MDAxMTU3OCIsImlhdCI6MTQ1MDkyOTI0NiwiZW1haWwiOm51bGwsImp0aSI6IjEzNjljNjAwLWUwYTEtNDUyNS1hN2M3LTU2YmU3ZDgxM2Y1MSJ9.SeLETowyDVJCGKGc0wjk4fPMH9pug7C9Yw_7xkI7Fvk" "http://localhost:3000/v4/topics?filter=reference%3Dsubmission%26referenceId%3D455"
```

You can also create posts in existing threads by doing the following:

First, Create `payload` file in the current directory, where the file content is like following:
```
{
    "post": "This is my response to the thread"
}
```

Then, run the following command, `@payload` is referencing the created file above.
```
curl -X POST -H "Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJhZG1pbmlzdHJhdG9yIl0sImlzcyI6Imh0dHBzOi8vYXBpLnRvcGNvZGVyLWRldi5jb20iLCJoYW5kbGUiOiJtYWdyYXRoZWFuIiwiZXhwIjoxNzY2Mjg5MjQ2LCJ1c2VySWQiOiI0MDAxMTU3OCIsImlhdCI6MTQ1MDkyOTI0NiwiZW1haWwiOm51bGwsImp0aSI6IjEzNjljNjAwLWUwYTEtNDUyNS1hN2M3LTU2YmU3ZDgxM2Y1MSJ9.SeLETowyDVJCGKGc0wjk4fPMH9pug7C9Yw_7xkI7Fvk" -H "Content-Type: application/json" "http://localhost:3000/v4/threads" -d @payload
```


## Unit tests
Please update test environment configurations in `config/config.json`.
```
export NODE_ENV=test
sequelize db:migrate
npm test
```
Then you can check coverage report in coverage folder.

## Postman
You can also verify the service using Postman. For this load files from the local/postman directory into Postman.
