#!/bin/bash

# Jenkins Troubleshooting Script
# This script helps diagnose and fix common Jenkins issues

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Jenkins Troubleshooting Tool${NC}"
echo "=================================="

# Function to show menu
show_menu() {
    echo ""
    echo -e "${BLUE}Select an option:${NC}"
    echo "1. Check Jenkins status"
    echo "2. View Jenkins logs"
    echo "3. Restart Jenkins"
    echo "4. Reset Jenkins completely"
    echo "5. Test Docker access"
    echo "6. Get admin password"
    echo "7. Check system resources"
    echo "8. Run full verification"
    echo "9. Fix credentials setup"
    echo "10. Exit"
    echo ""
    read -p "Enter your choice (1-10): " choice
}

# Function to check Jenkins status
check_status() {
    echo -e "${BLUE}📊 Checking Jenkins status...${NC}"
    
    if docker ps | grep -q jenkins; then
        echo -e "${GREEN}✅ Jenkins container is running${NC}"
        docker ps | grep jenkins
        
        if curl -f -s http://localhost:8080/login >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Jenkins web interface is accessible${NC}"
        else
            echo -e "${YELLOW}⚠️ Jenkins web interface is not accessible yet${NC}"
        fi
    else
        echo -e "${RED}❌ Jenkins container is not running${NC}"
    fi
}

# Function to view logs
view_logs() {
    echo -e "${BLUE}📋 Viewing Jenkins logs...${NC}"
    echo "Press Ctrl+C to stop viewing logs"
    sleep 2
    docker-compose -f docker-compose.jenkins.simple.yml logs -f --tail=50
}

# Function to restart Jenkins
restart_jenkins() {
    echo -e "${BLUE}🔄 Restarting Jenkins...${NC}"
    docker-compose -f docker-compose.jenkins.simple.yml restart
    echo -e "${GREEN}✅ Jenkins restart initiated${NC}"
    echo "Waiting for Jenkins to be ready..."
    sleep 30
    check_status
}

# Function to reset Jenkins
reset_jenkins() {
    echo -e "${YELLOW}⚠️ This will completely reset Jenkins and remove all data!${NC}"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🗑️ Resetting Jenkins...${NC}"
        docker-compose -f docker-compose.jenkins.simple.yml down -v
        docker rm -f jenkins || true
        docker volume rm oms_jenkins_data || true
        echo -e "${GREEN}✅ Jenkins reset complete${NC}"
        echo "Run ./scripts/fix-jenkins-docker.sh to set up Jenkins again"
    else
        echo "Reset cancelled"
    fi
}

# Function to test Docker access
test_docker() {
    echo -e "${BLUE}🐳 Testing Docker access in Jenkins...${NC}"
    
    if docker exec jenkins docker --version 2>/dev/null; then
        echo -e "${GREEN}✅ Docker is accessible${NC}"
        echo "Docker version in Jenkins:"
        docker exec jenkins docker --version
        
        echo "Testing Docker run capability..."
        if docker exec jenkins docker run --rm hello-world >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Docker run test passed${NC}"
        else
            echo -e "${RED}❌ Docker run test failed${NC}"
        fi
    else
        echo -e "${RED}❌ Docker is not accessible in Jenkins${NC}"
        echo "Try running: ./scripts/fix-jenkins-docker.sh"
    fi
}

# Function to get admin password
get_password() {
    echo -e "${BLUE}🔑 Getting Jenkins admin password...${NC}"
    
    if admin_password=$(docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null); then
        echo -e "${GREEN}✅ Admin password:${NC} $admin_password"
        echo ""
        echo "Use this password to log in at: http://localhost:8080"
    else
        echo -e "${RED}❌ Could not retrieve admin password${NC}"
        echo "Jenkins may not be fully initialized yet"
    fi
}

# Function to check system resources
check_resources() {
    echo -e "${BLUE}💻 Checking system resources...${NC}"
    
    echo "Memory usage:"
    free -h
    echo ""
    echo "Disk usage:"
    df -h
    echo ""
    echo "Docker system info:"
    docker system df
    echo ""
    echo "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Function to run full verification
run_verification() {
    echo -e "${BLUE}🔍 Running full verification...${NC}"
    ./scripts/verify-jenkins-setup.sh
}

# Function to fix credentials setup
fix_credentials() {
    echo -e "${BLUE}🔧 Jenkins Credentials Setup Guide${NC}"
    echo "=================================="
    echo ""
    echo -e "${YELLOW}Current Issues Detected:${NC}"
    echo "1. Docker Hub credentials not found with ID 'dockerhub'"
    echo "2. Credentials may be configured with wrong ID format"
    echo ""
    echo -e "${BLUE}Steps to Fix:${NC}"
    echo ""
    echo "1. Open Jenkins: http://localhost:8080"
    
    if admin_password=$(docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null); then
        echo "   Admin password: $admin_password"
    fi
    
    echo ""
    echo "2. Go to: Manage Jenkins → Manage Credentials → System → Global credentials"
    echo ""
    echo "3. Click 'Add Credentials' and create:"
    echo "   - Kind: Username with password"
    echo "   - Scope: Global"
    echo "   - Username: kushal493"
    echo "   - Password: dckr_pat_KPb1gKQLSGuQHTMhb67A7_kUlpQ"
    echo "   - ID: dockerhub"
    echo "   - Description: Docker Hub Credentials"
    echo ""
    echo "4. For EC2 SSH Key (if needed):"
    echo "   - Kind: SSH Username with private key"
    echo "   - Scope: Global"
    echo "   - ID: ec2-ssh-key"
    echo "   - Username: ec2-user"
    echo "   - Private Key: Enter directly or from file"
    echo ""
    echo "5. Set Global Environment Variables:"
    echo "   Go to: Manage Jenkins → Configure System → Global Properties"
    echo "   Check 'Environment variables' and add:"
    echo "   - EC2_HOST: <your-ec2-instance-ip>"
    echo "   - EC2_USER: ec2-user"
    echo ""
    echo -e "${GREEN}After setting up credentials, run your pipeline again!${NC}"
}

# Main loop
while true; do
    show_menu
    
    case $choice in
        1)
            check_status
            ;;
        2)
            view_logs
            ;;
        3)
            restart_jenkins
            ;;
        4)
            reset_jenkins
            ;;
        5)
            test_docker
            ;;
        6)
            get_password
            ;;
        7)
            check_resources
            ;;
        8)
            run_verification
            ;;
        9)
            fix_credentials
            ;;
        10)
            echo -e "${GREEN}👋 Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid option. Please try again.${NC}"
            ;;
    esac
    
    echo ""
    read -p "Press Enter to continue..."
done
