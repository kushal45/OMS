#!/bin/bash

# Exit on error
set -e

# Login to Docker Hub
# Note: This requires the DOCKERHUB_USERNAME and DOCKERHUB_PASSWORD environment variables to be set.
echo "$DOCKERHUB_PASSWORD" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin

# Pull the latest image
docker pull $DOCKER_IMAGE_NAME:latest

# Start the application
docker-compose -f docker-compose.app.slim.yml up -d --remove-orphans
