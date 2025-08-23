#!/bin/bash

# Docker Registry Credentials Diagnostic Script
# This script helps diagnose and validate Docker registry credentials in Jenkins

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔍 Docker Registry Credentials Diagnostic Tool${NC}"
echo "=================================================="
echo ""

# Function to check if Jenkins is running
check_jenkins_status() {
    echo -e "${CYAN}📋 Checking Jenkins status...${NC}"
    
    if ! docker ps | grep -q jenkins; then
        echo -e "${RED}❌ Jenkins container is not running${NC}"
        echo "Please start Jenkins first: docker-compose -f docker-compose.jenkins.simple.yml up -d"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Jenkins container is running${NC}"
}

# Function to get Jenkins admin password
get_jenkins_password() {
    echo -e "${CYAN}🔑 Getting Jenkins admin password...${NC}"
    
    if admin_password=$(docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null); then
        echo -e "${GREEN}✅ Jenkins admin password: ${admin_password}${NC}"
        echo -e "${BLUE}💡 Jenkins URL: http://localhost:8080${NC}"
    else
        echo -e "${YELLOW}⚠️ Could not get admin password. Jenkins may be already configured.${NC}"
    fi
    echo ""
}

# Function to check Docker Hub credentials in Jenkins
check_docker_credentials() {
    echo -e "${CYAN}🐳 Checking Docker Hub credentials configuration...${NC}"
    
    # Check if credentials directory exists
    if docker exec jenkins test -d "/var/jenkins_home/credentials.xml" 2>/dev/null; then
        echo -e "${GREEN}✅ Jenkins credentials directory exists${NC}"
    else
        echo -e "${YELLOW}⚠️ Jenkins credentials not yet configured${NC}"
    fi
    
    # Check for credential files
    local cred_files=$(docker exec jenkins find /var/jenkins_home -name "*credential*" -type f 2>/dev/null | wc -l || echo "0")
    echo -e "${BLUE}📋 Found ${cred_files} credential-related files${NC}"
}

# Function to test Docker Hub login directly
test_docker_hub_login() {
    echo -e "${CYAN}🔐 Testing Docker Hub login directly...${NC}"
    
    # Test with the credentials from the error message
    local username="kushal493"
    local token="dckr_pat_KPb1gKQLSGuQHTMhb67A7_kUlpQ"
    
    echo -e "${BLUE}📋 Testing credentials:${NC}"
    echo "Username: ${username}"
    echo "Token: ${token:0:20}..."
    echo ""
    
    # Test login inside Jenkins container
    if docker exec jenkins sh -c "echo '${token}' | docker login --username '${username}' --password-stdin" 2>/dev/null; then
        echo -e "${GREEN}✅ Docker Hub credentials are valid${NC}"
        
        # Test push capability with a test image
        echo -e "${CYAN}🧪 Testing push capability...${NC}"
        if docker exec jenkins sh -c "
            echo 'FROM alpine:latest' > /tmp/test.dockerfile
            echo 'RUN echo \"test\"' >> /tmp/test.dockerfile
            docker build -f /tmp/test.dockerfile -t ${username}/jenkins-test:$(date +%s) /tmp/
            docker push ${username}/jenkins-test:$(date +%s)
            rm /tmp/test.dockerfile
        " 2>/dev/null; then
            echo -e "${GREEN}✅ Docker Hub push test successful${NC}"
        else
            echo -e "${RED}❌ Docker Hub push test failed${NC}"
        fi
        
        # Logout
        docker exec jenkins docker logout
    else
        echo -e "${RED}❌ Docker Hub credentials are invalid or expired${NC}"
        echo -e "${YELLOW}💡 Please check your Docker Hub token permissions${NC}"
    fi
}

# Function to show credential configuration steps
show_credential_setup() {
    echo -e "${CYAN}🛠️ Jenkins Credential Configuration Steps${NC}"
    echo "=========================================="
    echo ""
    echo -e "${YELLOW}1. Open Jenkins UI:${NC}"
    echo "   URL: http://localhost:8080"
    echo ""
    echo -e "${YELLOW}2. Navigate to Credentials:${NC}"
    echo "   Manage Jenkins → Manage Credentials → System → Global credentials"
    echo ""
    echo -e "${YELLOW}3. Add Docker Hub Credentials:${NC}"
    echo "   - Click 'Add Credentials'"
    echo "   - Kind: Username with password"
    echo "   - Scope: Global"
    echo "   - Username: kushal493"
    echo "   - Password: dckr_pat_KPb1gKQLSGuQHTMhb67A7_kUlpQ"
    echo "   - ID: dockerhub"
    echo "   - Description: Docker Hub Credentials"
    echo ""
    echo -e "${YELLOW}4. Verify Configuration:${NC}"
    echo "   - The credential ID must be exactly 'dockerhub'"
    echo "   - Use your Docker Hub access token, not password"
    echo "   - Ensure the token has push permissions"
    echo ""
}

# Function to create a test pipeline for credential validation
create_test_pipeline() {
    echo -e "${CYAN}🧪 Creating credential test pipeline...${NC}"
    
    cat > /tmp/docker-credential-test.groovy << 'EOF'
pipeline {
    agent any
    
    stages {
        stage('Test Docker Credentials') {
            steps {
                script {
                    try {
                        echo "🔍 Testing Docker Hub credentials..."
                        
                        withDockerRegistry([credentialsId: 'dockerhub', url: 'https://index.docker.io/v1/']) {
                            sh '''
                                echo "✅ Docker Hub credentials loaded successfully"
                                echo "Current user: $(whoami)"
                                echo "Docker version: $(docker --version)"
                                
                                # Test docker info
                                echo "Testing docker info..."
                                docker info | head -5
                                
                                # Test image pull
                                echo "Testing image pull..."
                                docker pull alpine:latest
                                
                                echo "✅ All Docker credential tests passed"
                            '''
                        }
                    } catch (Exception e) {
                        error "❌ Docker credential test failed: ${e.getMessage()}"
                    }
                }
            }
        }
    }
}
EOF
    
    echo -e "${GREEN}✅ Test pipeline created at /tmp/docker-credential-test.groovy${NC}"
    echo -e "${BLUE}💡 You can copy this pipeline to Jenkins to test credentials${NC}"
}

# Function to show troubleshooting tips
show_troubleshooting_tips() {
    echo -e "${CYAN}🔧 Troubleshooting Tips${NC}"
    echo "======================"
    echo ""
    echo -e "${YELLOW}Common Issues:${NC}"
    echo "1. ❌ Credential ID mismatch"
    echo "   - Ensure the credential ID is exactly 'dockerhub'"
    echo "   - Check for typos or extra spaces"
    echo ""
    echo "2. ❌ Invalid Docker Hub token"
    echo "   - Generate a new access token from Docker Hub"
    echo "   - Ensure token has 'Read, Write, Delete' permissions"
    echo "   - Use token, not password"
    echo ""
    echo "3. ❌ Jenkins credential scope"
    echo "   - Use 'Global' scope for credentials"
    echo "   - Avoid 'System' scope for pipeline usage"
    echo ""
    echo "4. ❌ Docker registry URL"
    echo "   - Use 'https://index.docker.io/v1/' for Docker Hub"
    echo "   - Don't use 'https://hub.docker.com'"
    echo ""
    echo -e "${YELLOW}Verification Commands:${NC}"
    echo "• Check Jenkins logs: docker logs jenkins"
    echo "• Test Docker in Jenkins: docker exec jenkins docker --version"
    echo "• List credentials: Check Jenkins UI → Manage Credentials"
    echo "• Test pipeline: Use the generated test pipeline"
    echo ""
}

# Function to show current pipeline configuration
show_pipeline_config() {
    echo -e "${CYAN}📋 Current Pipeline Configuration${NC}"
    echo "=================================="
    echo ""
    echo -e "${BLUE}From your Jenkinsfile:${NC}"
    echo "withDockerRegistry([credentialsId: 'dockerhub', url: 'https://index.docker.io/v1/']) {"
    echo "    // Docker commands here"
    echo "}"
    echo ""
    echo -e "${YELLOW}Expected Credential Configuration:${NC}"
    echo "• ID: dockerhub"
    echo "• Type: Username with password"
    echo "• Username: kushal493"
    echo "• Password: dckr_pat_KPb1gKQLSGuQHTMhb67A7_kUlpQ"
    echo ""
}

# Main execution
main() {
    check_jenkins_status
    get_jenkins_password
    check_docker_credentials
    test_docker_hub_login
    
    echo ""
    show_credential_setup
    show_pipeline_config
    create_test_pipeline
    show_troubleshooting_tips
    
    echo ""
    echo -e "${GREEN}🎉 Diagnostic complete!${NC}"
    echo -e "${CYAN}💡 Next steps:${NC}"
    echo "1. Configure credentials in Jenkins UI using the steps above"
    echo "2. Run the test pipeline to verify credentials"
    echo "3. Re-run your main pipeline"
    echo ""
}

# Run main function
main "$@"
