# Remove all containers from this compose file
COMPOSE_PROJECT_NAME=oms

echo "Stopping and removing containers and networks defined in the Docker Compose files (volumes will be preserved)..."
docker compose -f docker-compose.infra.yml -f docker-compose.app.yml down --remove-orphans

echo "Removing images previously built by this compose project ($COMPOSE_PROJECT_NAME)..."
# Remove images built by this compose file (filter by project label)
images=$(docker images --filter label=com.docker.compose.project=$COMPOSE_PROJECT_NAME -q)
if [ -n "$images" ]; then
  docker rmi -f $images
else
  echo "No images to remove."
fi

echo "Pruning Docker build cache and dangling images..."
docker builder prune -af
docker image prune -f

# Check if the base application image exists
if ! docker image inspect oms-app-base >/dev/null 2>&1; then
  echo "Building the base application image..."
  docker compose --profile build-only -f docker-compose.infra.yml  -f docker-compose.app.yml build app-base
else
  echo "Base application image already exists. Skipping build."
fi

echo "Starting infrastructure and application services..."
docker compose -f docker-compose.infra.yml -f docker-compose.app.yml up -d --remove-orphans

echo "Watching for changes to docker-compose files..."
#docker compose watch
echo "Done."