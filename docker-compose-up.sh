# Remove all containers from this compose file
COMPOSE_PROJECT_NAME=oms

echo "Stopping and removing containers and networks defined in docker-compose.yml (volumes will be preserved)..."
docker compose -f docker-compose.yml down --remove-orphans

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

echo "Rebuilding (if necessary) and starting containers..."
docker compose -f docker-compose.yml up --build --remove-orphans -d

echo "Watching for changes to docker-compose.yml..."
#docker compose watch
echo "Done."