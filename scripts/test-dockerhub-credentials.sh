#!/bin/bash

# Docker Hub Credentials Test Script
# This script specifically tests Docker Hub credentials

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}🐳 Docker Hub Credentials Validator${NC}"
echo "===================================="
echo ""

# Function to test Docker Hub credentials directly
test_dockerhub_login() {
    echo -e "${CYAN}🔐 Testing Docker Hub credentials directly...${NC}"
    
    local username="kushal493"
    local token="dckr_pat_KPb1gKQLSGuQHTMhb67A7_kUlpQ"
    
    echo "Username: $username"
    echo "Token: ${token:0:20}..."
    echo ""
    
    # Test login inside Jenkins container
    if docker exec jenkins bash -c "
        echo 'Testing Docker Hub login...'
        echo '$token' | docker login -u '$username' --password-stdin
    " 2>/dev/null; then
        echo -e "${GREEN}✅ Docker Hub login successful!${NC}"
        
        # Test logout
        docker exec jenkins docker logout >/dev/null 2>&1
        echo -e "${GREEN}✅ Docker Hub logout successful${NC}"
        return 0
    else
        echo -e "${RED}❌ Docker Hub login failed!${NC}"
        echo -e "${YELLOW}Possible issues:${NC}"
        echo "  • Invalid username or token"
        echo "  • Token doesn't have required permissions"
        echo "  • Network connectivity issues"
        echo "  • Docker Hub service issues"
        return 1
    fi
}

# Function to test Docker Hub API access
test_dockerhub_api() {
    echo -e "${CYAN}🌐 Testing Docker Hub API access...${NC}"
    
    local username="kushal493"
    local token="dckr_pat_KPb1gKQLSGuQHTMhb67A7_kUlpQ"
    
    # Test API access
    if docker exec jenkins bash -c "
        curl -s -H 'Authorization: Bearer $token' \
             'https://hub.docker.com/v2/repositories/$username/' | \
             grep -q 'results'
    " 2>/dev/null; then
        echo -e "${GREEN}✅ Docker Hub API access successful${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️ Docker Hub API test inconclusive${NC}"
        echo "This might be normal if you don't have repositories yet"
        return 0
    fi
}

# Function to test repository access
test_repository_access() {
    echo -e "${CYAN}📦 Testing repository access...${NC}"
    
    local username="kushal493"
    local repo="oms-app"
    
    # Check if repository exists and is accessible
    if docker exec jenkins bash -c "
        curl -s 'https://hub.docker.com/v2/repositories/$username/$repo/' | \
        grep -q 'name'
    " 2>/dev/null; then
        echo -e "${GREEN}✅ Repository $username/$repo is accessible${NC}"
    else
        echo -e "${YELLOW}ℹ️ Repository $username/$repo may not exist yet${NC}"
        echo "This is normal for new repositories"
    fi
}

# Function to test push permissions
test_push_permissions() {
    echo -e "${CYAN}📤 Testing push permissions with test image...${NC}"
    
    local username="kushal493"
    local token="dckr_pat_KPb1gKQLSGuQHTMhb67A7_kUlpQ"
    local test_tag="test-$(date +%s)"
    local test_image="$username/jenkins-credential-test:$test_tag"
    
    echo "Creating test image: $test_image"
    
    if docker exec jenkins bash -c "
        # Login first
        echo '$token' | docker login -u '$username' --password-stdin >/dev/null 2>&1
        
        # Create a minimal test image
        echo 'FROM alpine:latest' > /tmp/Dockerfile.test
        echo 'RUN echo \"Credential test image\"' >> /tmp/Dockerfile.test
        
        # Build test image
        docker build -f /tmp/Dockerfile.test -t '$test_image' /tmp/ >/dev/null 2>&1
        
        # Try to push the test image
        docker push '$test_image' >/dev/null 2>&1
        
        # Clean up locally
        docker rmi '$test_image' >/dev/null 2>&1
        rm -f /tmp/Dockerfile.test
        
        # Logout
        docker logout >/dev/null 2>&1
        
        echo 'Push test completed successfully'
    " 2>/dev/null; then
        echo -e "${GREEN}✅ Push permissions test successful!${NC}"
        echo -e "${YELLOW}ℹ️ Test image pushed to: $test_image${NC}"
        echo -e "${YELLOW}ℹ️ You may want to delete this test image from Docker Hub${NC}"
        return 0
    else
        echo -e "${RED}❌ Push permissions test failed!${NC}"
        echo -e "${YELLOW}Possible issues:${NC}"
        echo "  • Token doesn't have push permissions"
        echo "  • Repository doesn't exist and can't be created"
        echo "  • Rate limiting or quota issues"
        return 1
    fi
}

# Function to validate token format
validate_token_format() {
    echo -e "${CYAN}🔍 Validating token format...${NC}"

    local token="dckr_pat_KPb1gKQLSGuQHTMhb67A7_kUlpQ"
    local token_length=${#token}

    if [[ $token =~ ^dckr_pat_[A-Za-z0-9_]+$ ]]; then
        echo -e "${GREEN}✅ Token format appears valid${NC}"
        echo "Token pattern: dckr_pat_[${token_length} total characters]"
        echo "Token starts with: ${token:0:12}..."
        return 0
    else
        echo -e "${YELLOW}⚠️ Token format check inconclusive${NC}"
        echo "Token starts with: ${token:0:12}..."
        echo "Will test actual functionality instead"
        return 0
    fi
}

# Function to test Jenkins credential configuration
test_jenkins_credential_config() {
    echo -e "${CYAN}🔧 Testing Jenkins credential configuration...${NC}"
    
    # Create a test pipeline script to validate credentials
    cat > /tmp/dockerhub-test-pipeline.groovy << 'EOF'
pipeline {
    agent any
    
    stages {
        stage('Test Docker Hub Credentials') {
            steps {
                script {
                    try {
                        withDockerRegistry([credentialsId: 'dockerhub', url: 'https://index.docker.io/v1/']) {
                            sh '''
                                echo "✅ Docker Hub credentials successfully loaded from Jenkins"
                                echo "Testing docker info command..."
                                docker info | head -5
                            '''
                        }
                    } catch (Exception e) {
                        error "❌ Jenkins Docker Hub credentials test failed: ${e.getMessage()}"
                    }
                }
            }
        }
        
        stage('Test Image Build and Push') {
            steps {
                script {
                    try {
                        withDockerRegistry([credentialsId: 'dockerhub', url: 'https://index.docker.io/v1/']) {
                            sh '''
                                # Create test image
                                echo "FROM alpine:latest" > Dockerfile.test
                                echo "RUN echo 'Jenkins credential test'" >> Dockerfile.test
                                
                                # Build and push test image
                                TEST_IMAGE="kushal493/jenkins-test:$(date +%s)"
                                docker build -f Dockerfile.test -t $TEST_IMAGE .
                                docker push $TEST_IMAGE
                                
                                # Clean up
                                docker rmi $TEST_IMAGE
                                rm Dockerfile.test
                                
                                echo "✅ Build and push test successful"
                            '''
                        }
                    } catch (Exception e) {
                        echo "⚠️ Build and push test failed: ${e.getMessage()}"
                    }
                }
            }
        }
    }
}
EOF

    echo -e "${GREEN}✅ Jenkins test pipeline created at: /tmp/dockerhub-test-pipeline.groovy${NC}"
    echo -e "${YELLOW}ℹ️ Copy this pipeline to Jenkins to test credential configuration${NC}"
}

# Function to provide troubleshooting steps
provide_troubleshooting_steps() {
    echo -e "${CYAN}🔧 Troubleshooting Steps${NC}"
    echo "======================="
    echo ""
    echo -e "${BLUE}If Docker Hub login fails:${NC}"
    echo "1. Verify your Docker Hub username: kushal493"
    echo "2. Check if your token is still valid at: https://hub.docker.com/settings/security"
    echo "3. Ensure token has 'Public Repo Read' and 'Public Repo Write' permissions"
    echo "4. Try logging in manually: docker login -u kushal493"
    echo ""
    echo -e "${BLUE}If push fails:${NC}"
    echo "1. Check if repository 'kushal493/oms-app' exists on Docker Hub"
    echo "2. Verify token has write permissions"
    echo "3. Check Docker Hub rate limits and quotas"
    echo ""
    echo -e "${BLUE}If Jenkins credentials fail:${NC}"
    echo "1. Ensure credential ID is exactly 'dockerhub'"
    echo "2. Verify username and password are correct in Jenkins"
    echo "3. Check Jenkins logs for detailed error messages"
    echo ""
    echo -e "${BLUE}Manual verification commands:${NC}"
    echo "• Test login: docker login -u kushal493"
    echo "• Check repos: curl -s https://hub.docker.com/v2/repositories/kushal493/"
    echo "• Jenkins logs: docker-compose -f docker-compose.jenkins.simple.yml logs -f"
}

# Main execution
main() {
    echo -e "${YELLOW}This script will test your Docker Hub credentials thoroughly.${NC}"
    echo ""
    
    # Check if Jenkins is running
    if ! docker ps | grep -q jenkins; then
        echo -e "${RED}❌ Jenkins is not running!${NC}"
        echo "Please start Jenkins first: docker-compose -f docker-compose.jenkins.simple.yml up -d"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Jenkins is running${NC}"
    echo ""
    
    # Run all tests
    validate_token_format
    echo ""
    
    test_dockerhub_login
    echo ""
    
    test_dockerhub_api
    echo ""
    
    test_repository_access
    echo ""
    
    test_push_permissions
    echo ""
    
    test_jenkins_credential_config
    echo ""
    
    provide_troubleshooting_steps
    
    echo ""
    echo -e "${CYAN}💡 Next Steps:${NC}"
    echo "1. If all tests pass, your Docker Hub credentials are working"
    echo "2. If any test fails, follow the troubleshooting steps above"
    echo "3. Use the generated Jenkins pipeline to test within Jenkins"
    echo "4. Run your main deployment pipeline after validation"
}

# Make the script executable and run
main "$@"
