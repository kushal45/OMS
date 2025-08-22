#!/bin/zsh
# Script to bring down docker-compose stack, remove all related containers and volumes, and clean up dangling resources (excluding images)

COMPOSE_PROJECT_NAME=oms

echo "Stopping and removing all containers, networks, and volumes defined in the Docker Compose files..."
docker compose -f docker-compose.infra.yml -f docker-compose.app.yml down --volumes --remove-orphans

echo "Pruning unused Docker resources (dangling containers and volumes, excluding images)..."
docker container prune -f
docker volume prune -f

echo "Done."
