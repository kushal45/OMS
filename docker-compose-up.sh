unused_volumes=$(docker volume ls -f dangling=true -q)
if [ -n "$unused_volumes" ]; then
  echo "Pruning unused Docker volumes..."
  docker volume prune -f
else
  echo "No unused Docker volumes found."
fi
docker-compose -f docker-compose.yml down
#check for containers having the prefix oms and remove them
docker ps -a | grep oms | awk '{print $1}' | xargs docker rm -f
#remove the corresponding matching images
docker images | grep oms | awk '{print $3}' | xargs docker rmi -f
docker image prune -f
DEBUG=1 docker-compose -f docker-compose.yml up --remove-orphans --build -d