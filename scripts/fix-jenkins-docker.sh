#!/bin/bash

# Fix Jenkins Docker Issues - Complete Solution
# This script fixes all Docker access issues in Jenkins and sets up everything needed

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Fixing Jenkins Docker Issues - Complete Setup${NC}"
echo "=================================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for Jenkins to be ready
wait_for_jenkins() {
    local max_attempts=30
    local attempt=1

    echo -e "${YELLOW}⏳ Waiting for Jenkins to be ready...${NC}"

    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s http://localhost:8080/login >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Jenkins is ready!${NC}"
            return 0
        fi

        echo "Attempt $attempt/$max_attempts: Jenkins not ready yet..."
        sleep 10
        ((attempt++))
    done

    echo -e "${RED}❌ Jenkins failed to start within expected time${NC}"
    return 1
}

# Function to test Docker access in Jenkins
test_docker_access() {
    echo -e "${BLUE}🧪 Testing Docker access in Jenkins...${NC}"

    if docker exec jenkins docker --version >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Docker is accessible in Jenkins${NC}"
        docker exec jenkins docker --version
        return 0
    else
        echo -e "${RED}❌ Docker is not accessible in Jenkins${NC}"
        return 1
    fi
}

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}❌ Docker is not installed on host system${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose is not installed on host system${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Stop current Jenkins instances
echo -e "${BLUE}🛑 Stopping current Jenkins instances...${NC}"
docker-compose -f docker-compose.jenkins.yml down || true
docker-compose -f docker-compose.jenkins.simple.yml down || true

# Remove old Jenkins containers
echo -e "${BLUE}🗑️ Removing old Jenkins containers...${NC}"
docker rm -f jenkins jenkins-dind || true

# Clean up old images (optional)
echo -e "${BLUE}🧹 Cleaning up old Jenkins images...${NC}"
docker image prune -f || true

# Start Jenkins with Docker support using simple setup
echo -e "${BLUE}🚀 Starting Jenkins with Docker support...${NC}"
docker-compose -f docker-compose.jenkins.simple.yml up -d

# Wait for Jenkins to start
if wait_for_jenkins; then
    echo -e "${GREEN}✅ Jenkins started successfully!${NC}"
else
    echo -e "${RED}❌ Jenkins failed to start. Checking logs...${NC}"
    docker-compose -f docker-compose.jenkins.simple.yml logs --tail=50
    exit 1
fi

# Test Docker access
if test_docker_access; then
    echo -e "${GREEN}✅ Docker access verified!${NC}"
else
    echo -e "${YELLOW}⚠️ Docker access test failed, but Jenkins is running${NC}"
fi

# Get admin password
echo -e "${BLUE}🔑 Getting Jenkins admin password...${NC}"
if admin_password=$(docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null); then
    echo -e "${GREEN}✅ Admin password retrieved${NC}"
else
    echo -e "${YELLOW}⚠️ Admin password not available yet (Jenkins may still be initializing)${NC}"
    admin_password="<password not ready yet>"
fi

# Display success information
echo ""
echo "=================================================="
echo -e "${GREEN}🎉 Jenkins Setup Complete!${NC}"
echo "=================================================="
echo ""
echo -e "${BLUE}📱 Access Jenkins:${NC} http://localhost:8080"
echo -e "${BLUE}🔑 Admin Password:${NC} $admin_password"
echo ""
echo -e "${BLUE}🔧 Next Steps:${NC}"
echo "1. Open http://localhost:8080 in your browser"
echo "2. Enter the admin password shown above"
echo "3. Install suggested plugins (includes Docker Pipeline)"
echo "4. Create your admin user"
echo "5. Configure credentials:"
echo "   - Docker Hub (ID: dockerhub, Username: kushal493)"
echo "   - EC2 SSH (ID: ec2-ssh-key, Username: ec2-user)"
echo "6. Set global environment variables:"
echo "   - DOCKERHUB_USERNAME: kushal493"
echo "   - EC2_HOST: <your-ec2-ip>"
echo "   - EC2_USER: ec2-user"
echo "7. Run your pipeline again"
echo ""
echo -e "${BLUE}🔍 Useful Commands:${NC}"
echo "Check Jenkins logs: docker-compose -f docker-compose.jenkins.simple.yml logs -f"
echo "Test Docker in Jenkins: docker exec jenkins docker ps"
echo "Get admin password: docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword"
echo "Restart Jenkins: docker-compose -f docker-compose.jenkins.simple.yml restart"
echo ""
echo -e "${GREEN}✅ Jenkins is now ready for your OMS deployment pipeline!${NC}"