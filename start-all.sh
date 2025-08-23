#!/bin/bash

# Exit on any error
set -e

# --- Start Infrastructure ---
echo "Starting infrastructure services (Postgres, Kafka, Redis)..."
docker-compose -f docker-compose.infra.slim.yml up -d

# Wait for services to be healthy. A simple sleep is used for now.
# A more robust solution would use a tool like docker-compose-wait or custom health checks.
echo "Waiting for infrastructure to initialize..."
sleep 20

# --- Start Application Services ---
echo "Starting application services..."
docker-compose -f docker-compose.app.slim.yml up -d

# --- Start Jenkins ---
echo "Starting Jenkins..."
docker-compose -f docker-compose.jenkins.yml up -d

echo "All services started successfully."
