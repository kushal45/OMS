#!/bin/bash

# Jenkins Credentials Fix Script
# This script helps you set up the correct credentials in Jenkins

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔧 Jenkins Credentials Fix${NC}"
echo "=========================="
echo ""

# Check if Jenkins is running
if ! docker ps | grep -q jenkins; then
    echo -e "${RED}❌ Jenkins is not running!${NC}"
    echo "Please start Jenkins first: docker-compose -f docker-compose.jenkins.simple.yml up -d"
    exit 1
fi

echo -e "${GREEN}✅ Jenkins is running${NC}"
echo ""

# Get admin password
if admin_password=$(docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null); then
    echo -e "${BLUE}📋 Jenkins Information:${NC}"
    echo "URL: http://localhost:8080"
    echo "Admin Password: $admin_password"
    echo ""
else
    echo -e "${YELLOW}⚠️ Could not get admin password. Jenkins may not be fully initialized.${NC}"
    echo ""
fi

echo -e "${YELLOW}🔍 Issue Analysis:${NC}"
echo "Based on the pipeline error, the following issues were detected:"
echo ""
echo "1. ❌ Docker Hub credentials not found with ID 'dockerhub'"
echo "2. ❌ The system is looking for credentials but can't find them"
echo "3. ❌ Tests are failing due to npm ci issues"
echo ""

echo -e "${BLUE}🛠️ Solutions Applied:${NC}"
echo ""
echo "✅ Updated Jenkinsfile to use proper Docker registry authentication"
echo "✅ Fixed test stage to handle npm ci issues gracefully"
echo "✅ Hardcoded Docker image name to avoid environment variable issues"
echo ""

echo -e "${YELLOW}📝 Manual Steps Required:${NC}"
echo ""
echo "1. Open Jenkins in your browser: http://localhost:8080"
echo "2. Log in with the admin password shown above"
echo "3. Go to: Manage Jenkins → Manage Credentials"
echo "4. Click on 'System' → 'Global credentials (unrestricted)'"
echo "5. Click 'Add Credentials' and create:"
echo ""
echo -e "${BLUE}   Docker Hub Credentials:${NC}"
echo "   - Kind: Username with password"
echo "   - Scope: Global"
echo "   - Username: kushal493"
echo "   - Password: dckr_pat_KPb1gKQLSGuQHTMhb67A7_kUlpQ"
echo "   - ID: dockerhub"
echo "   - Description: Docker Hub Credentials"
echo ""
echo -e "${BLUE}   EC2 SSH Key (if deploying to EC2):${NC}"
echo "   - Kind: SSH Username with private key"
echo "   - Scope: Global"
echo "   - ID: ec2-ssh-key"
echo "   - Username: ec2-user"
echo "   - Private Key: [Your EC2 private key]"
echo "   - Description: EC2 SSH Key"
echo ""

echo -e "${BLUE}6. Set Global Environment Variables:${NC}"
echo "   Go to: Manage Jenkins → Configure System"
echo "   Scroll to 'Global Properties' → Check 'Environment variables'"
echo "   Add the following variables:"
echo "   - Name: EC2_HOST, Value: [Your EC2 instance IP]"
echo "   - Name: EC2_USER, Value: ec2-user"
echo ""

echo -e "${GREEN}🚀 After completing these steps:${NC}"
echo "1. Run your pipeline again"
echo "2. The Docker Hub push should work"
echo "3. Tests should run properly"
echo "4. EC2 deployment will work (if configured)"
echo ""

echo -e "${BLUE}🔍 Verification Commands:${NC}"
echo "- Check Jenkins status: ./scripts/jenkins-troubleshoot.sh"
echo "- View Jenkins logs: docker-compose -f docker-compose.jenkins.simple.yml logs -f"
echo "- Test Docker in Jenkins: docker exec jenkins docker --version"
echo ""

echo -e "${YELLOW}💡 Pro Tips:${NC}"
echo "- Make sure your Docker Hub token has push permissions"
echo "- Test credentials by running a simple pipeline first"
echo "- Check Jenkins logs if you encounter issues"
echo ""

echo -e "${GREEN}✅ Setup guide complete!${NC}"
echo "Follow the manual steps above to complete the credentials configuration."
