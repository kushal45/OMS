#!/bin/bash

# Start Jenkins Locally for OMS Deployment
# This script starts Jenkins on your local machine to deploy to EC2

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}🚀 Starting Jenkins locally for OMS deployment...${NC}"

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if Jenkins is already running
if docker ps | grep -q jenkins; then
    echo -e "${GREEN}✅ Jenkins is already running${NC}"
    echo -e "${BLUE}📱 Access Jenkins at: http://localhost:8080${NC}"
    exit 0
fi

# Start Jenkins
echo -e "${BLUE}🔄 Starting Jenkins container...${NC}"
docker-compose -f docker-compose.jenkins.yml up -d

# Wait for Jenkins to start
echo -e "${BLUE}⏳ Waiting for Jenkins to start...${NC}"
sleep 30

# Check if Jenkins started successfully
if docker ps | grep -q jenkins; then
    echo -e "${GREEN}✅ Jenkins started successfully!${NC}"
    echo ""
    echo -e "${BLUE}📱 Access Jenkins at: http://localhost:8080${NC}"
    echo ""
    echo -e "${YELLOW}🔑 Initial admin password:${NC}"
    docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null || echo "Password not available yet, wait a moment and try: docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword"
    echo ""
    echo -e "${BLUE}📋 Next steps:${NC}"
    echo "1. Open http://localhost:8080 in your browser"
    echo "2. Enter the admin password shown above"
    echo "3. Install suggested plugins"
    echo "4. Create your admin user"
    echo "5. Configure credentials for Docker Hub and EC2"
    echo ""
    echo -e "${BLUE}🛑 To stop Jenkins later:${NC}"
    echo "docker-compose -f docker-compose.jenkins.yml down"
else
    echo -e "${YELLOW}❌ Jenkins failed to start. Check logs:${NC}"
    docker-compose -f docker-compose.jenkins.yml logs
    exit 1
fi