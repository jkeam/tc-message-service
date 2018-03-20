#!/usr/bin/env bash

# more bash-friendly output for jq
JQ="jq --raw-output --exit-status"

ENV=$1
ACCOUNT_ID=$(eval "echo \$${ENV}_AWS_ACCOUNT_ID")
AWS_ECS_CONTAINER_NAME="tc-message-service"
AWS_REPOSITORY=$(eval "echo \$${ENV}_AWS_REPOSITORY")
AWS_ECS_CLUSTER="tc-message-service"
AWS_ECS_SERVICE=$(eval "echo \$${ENV}_AWS_ECS_SERVICE")
AUTH_DOMAIN=$(eval "echo \$${ENV}_AUTH_DOMAIN")
AUTH_SECRET=$(eval "echo \$${ENV}_AUTH_SECRET")
PORT=3000
family="tc-message-service"

configure_aws_cli() {
  export AWS_ACCESS_KEY_ID=$(eval "echo \$${ENV}_AWS_ACCESS_KEY_ID")
  export AWS_SECRET_ACCESS_KEY=$(eval "echo \$${ENV}_AWS_SECRET_ACCESS_KEY")
  aws --version
  aws configure set default.region $AWS_REGION
  aws configure set default.output json
}

deploy_cluster() {

    make_task_def
    register_definition
    if [[ $(aws ecs update-service --cluster $AWS_ECS_CLUSTER --service $AWS_ECS_SERVICE --task-definition $revision | \
                   $JQ '.service.taskDefinition') != $revision ]]; then
        echo "Error updating service."
        return 1
    fi

    echo "Deployed!"
    return 0
}

make_task_def(){
  task_template='{
   "family": "%s",
   "requiresCompatibilities": ["EC2", "FARGATE"],
   "networkMode": "awsvpc",
   "executionRoleArn": "arn:aws:iam::%s:role/ecsTaskExecutionRole",
   "cpu": "1024",
   "memory": "2048",
   "containerDefinitions": [
    {
      "name": "%s",
      "image": "%s.dkr.ecr.%s.amazonaws.com/%s:%s",
      "essential": true,
      "memory": 200,
      "cpu": 10,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "%s"
        },
        {
          "name": "LOG_LEVEL",
          "value": "%s"
        },
        {
          "name": "CAPTURE_LOGS",
          "value": "%s"
        },
        {
          "name": "LOGENTRIES_TOKEN",
          "value": "%s"
        },
        {
          "name": "API_VERSION",
          "value": "%s"
        },
        {
          "name": "AUTH_DOMAIN",
          "value": "%s"
        },
        {
          "name": "AUTH_SECRET",
          "value": "%s"
        },
        {
          "name": "DB_MASTER_URL",
          "value": "%s"
        },
        {
          "name": "RABBITMQ_URL",
          "value": "%s"
        },
        {
          "name": "MEMBER_SERVICE_URL",
          "value": "%s"
        },
        {
          "name": "IDENTITY_SERVICE_ENDPOINT",
          "value": "%s"
        },
        {
          "name": "SYSTEM_USER_CLIENT_ID",
          "value": "%s"
        },
        {
          "name": "SYSTEM_USER_CLIENT_SECRET",
          "value": "%s"
        }
      ],
      "portMappings": [
        {
          "hostPort": %s,
          "protocol": "tcp",
          "containerPort": %s
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/aws/ecs/%s",
          "awslogs-region": "%s",
          "awslogs-stream-prefix": "%s"
        }
      }
    }
  ]}'
  API_VERSION=$(eval "echo \$${ENV}_API_VERSION")
  DB_MASTER_URL=$(eval "echo \$${ENV}_DB_MASTER_URL")
  RABBITMQ_URL=$(eval "echo \$${ENV}_RABBITMQ_URL")
  MEMBER_SERVICE_URL=$(eval "echo \$${ENV}_MEMBER_SERVICE_URL")
  IDENTITY_SERVICE_ENDPOINT=$(eval "echo \$${ENV}_IDENTITY_SERVICE_ENDPOINT")
  SYSTEM_USER_CLIENT_ID=$(eval "echo \$${ENV}_SYSTEM_USER_CLIENT_ID")
  SYSTEM_USER_CLIENT_SECRET=$(eval "echo \$${ENV}_SYSTEM_USER_CLIENT_SECRET")
  CAPTURE_LOGS=$(eval "echo \$${ENV}_CAPTURE_LOGS")
  LOGENTRIES_TOKEN=$(eval "echo \$${ENV}_LOGENTRIES_TOKEN")
  LOG_LEVEL=$(eval "echo \$${ENV}_LOG_LEVEL")
  if [ "$ENV" = "PROD" ]; then
    NODE_ENV=production
  elif [ "$ENV" = "DEV" ]; then
    NODE_ENV=development
  fi
  echo "NODE_ENV"
  echo $NODE_ENV

  task_def=$(printf "$task_template" $family $ACCOUNT_ID $AWS_ECS_CONTAINER_NAME $ACCOUNT_ID $AWS_REGION $AWS_REPOSITORY $CIRCLE_SHA1 $NODE_ENV $LOG_LEVEL $CAPTURE_LOGS $LOGENTRIES_TOKEN $API_VERSION $AUTH_DOMAIN $AUTH_SECRET $DB_MASTER_URL $RABBITMQ_URL $MEMBER_SERVICE_URL $IDENTITY_SERVICE_ENDPOINT $SYSTEM_USER_CLIENT_ID $SYSTEM_USER_CLIENT_SECRET $PORT $PORT $AWS_ECS_CLUSTER $AWS_REGION $NODE_ENV)
}

push_ecr_image(){
  eval $(aws ecr get-login --region $AWS_REGION --no-include-email)
  docker push $ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$AWS_REPOSITORY:$CIRCLE_SHA1
}

register_definition() {
    if revision=$(aws ecs register-task-definition --cli-input-json "$task_def" | $JQ '.taskDefinition.taskDefinitionArn'); then
        echo "Revision: $revision"
    else
        echo "Failed to register task definition"
        return 1
    fi
}

configure_aws_cli
push_ecr_image
deploy_cluster