#!/bin/bash

# Build the base image first
echo "Building the shared base image..."

# Check if docker-compose or docker compose should be used
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE="docker-compose"
else
    DOCKER_COMPOSE="docker compose"
fi

# Build the app-base service with the build-only profile
docker build -t oms-app-base -f ./Dockerfile

echo "Base image built successfully!"
echo ""
echo "You can now start the services with:"
echo "  ./docker-compose-up.sh"
echo ""
echo "Or start specific services:"
echo "  $DOCKER_COMPOSE up -d gateway auth order inventory product cart"
echo ""
echo "The base image will be reused for all Node.js services,"
echo "avoiding multiple npm install runs."