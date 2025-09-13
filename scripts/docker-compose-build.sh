#!/bin/bash

# This script builds the development image using the configuration from docker-compose.app.yml.
echo "Building the shared development base image..."

# Check if docker-compose or docker compose should be used
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

# Build the app-base service defined in the compose file.
# This command specifically targets the 'app-base' service in the 'docker-compose.app.yml' file.
# That service is configured to build the 'development' stage of our multi-stage Dockerfile.
$DOCKER_COMPOSE --profile build-only -f docker-compose.infra.yml -f docker-compose.app.yml build app-base

echo "Development base image built successfully!"
echo ""
echo "To build the production image, you can run a similar command:"
echo "  $DOCKER_COMPOSE -f docker-compose.app.slim.yml -f docker-compose.infra.slim.yml build app-base"
echo ""
echo "You can now start the development services with:"
echo "  ./scripts/docker-compose-up.sh"
echo ""