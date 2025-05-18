unused_volumes=$(docker volume ls -f dangling=true -q)
if [ -n "$unused_volumes" ]; then
  echo "Pruning unused Docker volumes..."
  docker volume prune -f
else
  echo "No unused Docker volumes found."
fi
docker image prune -f
DEBUG=1 docker-compose -f docker-compose.yml up --remove-orphans --build -d
docker compose watch