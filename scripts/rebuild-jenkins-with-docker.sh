#!/bin/bash

# Rebuild Jenkins with Latest LTS Version and Docker Support
# This script rebuilds Jenkins with the latest LTS version to resolve plugin compatibility issues

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🔧 Rebuilding Jenkins with Latest LTS Version${NC}"
echo "=============================================="
echo ""
echo -e "${YELLOW}⚠️ This will upgrade Jenkins to the latest LTS version${NC}"
echo -e "${YELLOW}   to resolve plugin dependency compatibility issues${NC}"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${CYAN}📋 Checking prerequisites...${NC}"
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running!${NC}"
        echo "Please start Docker Desktop and try again."
        exit 1
    fi
    
    # Check if required files exist
    if [[ ! -f "Dockerfile.jenkins" ]]; then
        echo -e "${RED}❌ Dockerfile.jenkins not found!${NC}"
        exit 1
    fi
    
    if [[ ! -f "docker-compose.jenkins.simple.yml" ]]; then
        echo -e "${RED}❌ docker-compose.jenkins.simple.yml not found!${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to stop current Jenkins
stop_current_jenkins() {
    echo -e "${CYAN}🛑 Stopping current Jenkins instances...${NC}"
    
    # Stop using docker-compose
    docker-compose -f docker-compose.jenkins.simple.yml down || true
    
    # Force stop any remaining Jenkins containers
    docker stop jenkins 2>/dev/null || true
    docker rm jenkins 2>/dev/null || true
    
    echo -e "${GREEN}✅ Current Jenkins instances stopped${NC}"
}

# Function to clean up old images
cleanup_old_images() {
    echo -e "${CYAN}🧹 Cleaning up old Jenkins images...${NC}"
    
    # Remove old custom Jenkins images
    docker rmi jenkins-with-docker:latest 2>/dev/null || true
    
    # Clean up dangling images
    docker image prune -f
    
    echo -e "${GREEN}✅ Old images cleaned up${NC}"
}

# Function to build new Jenkins image
build_jenkins_image() {
    echo -e "${CYAN}🏗️ Building new Jenkins image with Docker support...${NC}"
    echo "This may take several minutes..."
    echo ""

    # Validate plugins.txt exists
    if [ ! -f "plugins.txt" ]; then
        echo -e "${RED}❌ plugins.txt file not found${NC}"
        exit 1
    fi

    echo -e "${CYAN}📋 Validating plugins.txt...${NC}"
    local plugin_count=$(grep -v '^#' plugins.txt | grep -v '^$' | wc -l | tr -d ' ')
    echo "Found $plugin_count plugin entries"

    # Build the custom Jenkins image with no cache to ensure fresh plugin installation
    echo -e "${CYAN}🔨 Building Jenkins image with enhanced plugin management...${NC}"
    if docker build -f Dockerfile.jenkins -t jenkins-with-docker:latest . --no-cache; then
        echo -e "${GREEN}✅ Jenkins image built successfully with all plugins${NC}"
    else
        echo -e "${RED}❌ Failed to build Jenkins image${NC}"
        echo -e "${YELLOW}💡 Check the build logs above for plugin dependency errors${NC}"
        exit 1
    fi
}

# Function to start new Jenkins
start_new_jenkins() {
    echo -e "${CYAN}🚀 Starting new Jenkins with Docker support...${NC}"
    
    # Start Jenkins using docker-compose
    if docker-compose -f docker-compose.jenkins.simple.yml up -d; then
        echo -e "${GREEN}✅ Jenkins started successfully${NC}"
    else
        echo -e "${RED}❌ Failed to start Jenkins${NC}"
        exit 1
    fi
}

# Function to wait for Jenkins to be ready
wait_for_jenkins() {
    echo -e "${CYAN}⏳ Waiting for Jenkins to be ready...${NC}"
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:8080/login >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Jenkins is ready!${NC}"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts - Jenkins not ready yet..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    echo -e "${YELLOW}⚠️ Jenkins may still be starting up. Check manually at http://localhost:8080${NC}"
}

# Function to verify Docker installation
verify_docker_installation() {
    echo -e "${CYAN}🐳 Verifying Docker installation in Jenkins...${NC}"
    
    # Wait a bit more for Jenkins to fully initialize
    sleep 10
    
    if docker exec jenkins docker --version >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Docker is installed and accessible in Jenkins${NC}"
        docker exec jenkins docker --version
        
        # Test Docker functionality
        if docker exec jenkins docker run --rm hello-world >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Docker functionality test passed${NC}"
        else
            echo -e "${YELLOW}⚠️ Docker functionality test failed, but Docker is installed${NC}"
        fi
    else
        echo -e "${RED}❌ Docker is not accessible in Jenkins${NC}"
        echo "You may need to check the container logs:"
        echo "docker-compose -f docker-compose.jenkins.simple.yml logs jenkins"
        return 1
    fi
}

# Function to show next steps
show_next_steps() {
    echo ""
    echo -e "${BLUE}🎉 Jenkins with Docker Support Setup Complete!${NC}"
    echo "=============================================="
    echo ""
    echo -e "${CYAN}📋 Jenkins Information:${NC}"
    echo "• URL: http://localhost:8080"
    echo "• Container: jenkins"
    echo "• Docker: ✅ Installed and ready"
    echo ""
    
    # Try to get admin password
    if admin_password=$(docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null); then
        echo -e "${CYAN}🔑 Admin Password:${NC} $admin_password"
    else
        echo -e "${CYAN}🔑 Admin Password:${NC} Already configured (check Jenkins UI)"
    fi
    
    echo ""
    echo -e "${CYAN}🔧 Verification Commands:${NC}"
    echo "• Test Docker: docker exec jenkins docker --version"
    echo "• View logs: docker-compose -f docker-compose.jenkins.simple.yml logs -f"
    echo "• Restart: docker-compose -f docker-compose.jenkins.simple.yml restart"
    echo ""
    echo -e "${CYAN}🚀 Next Steps:${NC}"
    echo "1. Open Jenkins: http://localhost:8080"
    echo "2. Configure credentials (Docker Hub, SSH, etc.)"
    echo "3. Run credential validation: ./scripts/test-all-credentials.sh"
    echo "4. Run your deployment pipeline"
    echo ""
    echo -e "${GREEN}✅ Ready for deployment pipelines with Docker support!${NC}"
}

# Main execution
main() {
    echo -e "${YELLOW}This script will rebuild Jenkins with Docker pre-installed.${NC}"
    echo -e "${YELLOW}This will stop the current Jenkins instance and rebuild it.${NC}"
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Operation cancelled."
        exit 0
    fi
    
    echo ""
    
    # Run all steps
    check_prerequisites
    echo ""
    
    stop_current_jenkins
    echo ""
    
    cleanup_old_images
    echo ""
    
    build_jenkins_image
    echo ""
    
    start_new_jenkins
    echo ""
    
    wait_for_jenkins
    echo ""
    
    verify_docker_installation
    echo ""
    
    show_next_steps
}

# Run the main function
main "$@"
