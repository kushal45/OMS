#!/bin/bash

# Dynamic Jenkins Credentials Validation Script
# This script dynamically checks Jenkins configuration and credentials

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔍 Dynamic Jenkins Credentials Validation${NC}"
echo "============================================="
echo ""

# Function to check Jenkins container status
check_jenkins_container() {
    echo -e "${CYAN}📋 Checking Jenkins container...${NC}"
    
    if docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep jenkins; then
        echo -e "${GREEN}✅ Jenkins container is running${NC}"
    else
        echo -e "${RED}❌ Jenkins container not found${NC}"
        exit 1
    fi
}

# Function to check Jenkins credentials directory structure
check_credentials_structure() {
    echo -e "${CYAN}🔑 Checking Jenkins credentials structure...${NC}"
    
    # Check if credentials.xml exists
    if docker exec jenkins test -f "/var/jenkins_home/credentials.xml" 2>/dev/null; then
        echo -e "${GREEN}✅ Main credentials.xml exists${NC}"
        
        # Try to read credentials (safely)
        echo -e "${BLUE}📋 Credentials file structure:${NC}"
        docker exec jenkins ls -la /var/jenkins_home/ | grep -E "(credential|secret)" || echo "No credential files found in root"
        
    else
        echo -e "${YELLOW}⚠️ Main credentials.xml not found${NC}"
    fi
    
    # Check for credential store directories
    echo -e "${BLUE}📂 Checking credential store directories:${NC}"
    docker exec jenkins find /var/jenkins_home -name "*credential*" -type d 2>/dev/null | head -10 || echo "No credential directories found"
    
    # Check for secret files
    echo -e "${BLUE}🔐 Checking secret files:${NC}"
    docker exec jenkins find /var/jenkins_home -name "*secret*" -type f 2>/dev/null | head -10 || echo "No secret files found"
}

# Function to check Jenkins API for credentials
check_jenkins_api_credentials() {
    echo -e "${CYAN}🌐 Checking Jenkins API for credentials...${NC}"
    
    # Try to access Jenkins API
    local jenkins_url="http://localhost:8080"
    
    # Check if Jenkins is accessible
    if curl -s -f "${jenkins_url}/api/json" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Jenkins API is accessible (no auth required)${NC}"
        
        # Try to get credentials list (this might require auth)
        if curl -s -f "${jenkins_url}/credentials/store/system/domain/_/api/json" 2>/dev/null; then
            echo -e "${GREEN}✅ Credentials API accessible${NC}"
        else
            echo -e "${YELLOW}⚠️ Credentials API requires authentication${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️ Jenkins API requires authentication${NC}"
    fi
}

# Function to check credential files directly
check_credential_files() {
    echo -e "${CYAN}📄 Checking credential files directly...${NC}"
    
    # Check for the specific credential ID we need
    local cred_id="dockerhub"
    
    echo -e "${BLUE}🔍 Looking for credential ID: ${cred_id}${NC}"
    
    # Search for credential files containing our ID
    if docker exec jenkins find /var/jenkins_home -type f -exec grep -l "dockerhub" {} \; 2>/dev/null | head -5; then
        echo -e "${GREEN}✅ Found files containing 'dockerhub'${NC}"
    else
        echo -e "${RED}❌ No files found containing 'dockerhub'${NC}"
    fi
    
    # Check Jenkins logs for credential-related errors
    echo -e "${BLUE}📋 Recent credential-related log entries:${NC}"
    docker logs jenkins 2>&1 | grep -i "credential\|dockerhub" | tail -5 || echo "No credential-related logs found"
}

# Function to test Docker Hub credentials manually
test_docker_credentials_manual() {
    echo -e "${CYAN}🧪 Testing Docker Hub credentials manually...${NC}"
    
    local username="kushal493"
    local token="05051993@Pom"
    
    echo -e "${BLUE}📋 Testing with credentials:${NC}"
    echo "Username: ${username}"
    echo "Token: ${token:0:20}..."
    
    # Test login in Jenkins container
    if docker exec jenkins sh -c "echo '${token}' | docker login --username '${username}' --password-stdin" 2>/dev/null; then
        echo -e "${GREEN}✅ Manual Docker login successful${NC}"
        docker exec jenkins docker logout 2>/dev/null
    else
        echo -e "${RED}❌ Manual Docker login failed${NC}"
    fi
}

# Function to show Jenkins credential configuration steps
show_credential_config_steps() {
    echo -e "${CYAN}🛠️ Jenkins Credential Configuration Steps${NC}"
    echo "=========================================="
    echo ""
    echo -e "${YELLOW}Based on the pipeline error, you need to add Docker Hub credentials:${NC}"
    echo ""
    echo "1. Open Jenkins: http://localhost:8080"
    echo "2. Go to: Manage Jenkins → Manage Credentials"
    echo "3. Click: System → Global credentials (unrestricted)"
    echo "4. Click: Add Credentials"
    echo "5. Configure exactly as follows:"
    echo ""
    echo -e "${BLUE}   Credential Configuration:${NC}"
    echo "   - Kind: Username with password"
    echo "   - Scope: Global (Jenkins, nodes, items, all child items, etc)"
    echo "   - Username: kushal493"
    echo "   - Password: 05051993@Pom"
    echo "   - ID:dockerhub"
    echo "   - Description: Docker Hub Credentials"
    echo ""
    echo -e "${RED}⚠️ CRITICAL: The ID must be exactly 'dockerhub' (no spaces, no typos)${NC}"
    echo ""
}

# Function to create a credential test pipeline
create_credential_test() {
    echo -e "${CYAN}🧪 Creating credential test pipeline...${NC}"
    
    cat > /tmp/jenkins-credential-test.groovy << 'EOF'
pipeline {
    agent any
    
    stages {
        stage('Test Credentials') {
            steps {
                script {
                    echo "🔍 Testing credential availability..."
                    
                    // List available credentials (this will show if dockerhub exists)
                    try {
                        withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                            echo "✅ Credential 'dockerhub' found and accessible"
                            echo "Username: ${DOCKER_USER}"
                            echo "Password length: ${DOCKER_PASS.length()}"
                        }
                    } catch (Exception e) {
                        error "❌ Credential 'dockerhub' not found or not accessible: ${e.getMessage()}"
                    }
                    
                    // Test Docker registry access
                    try {
                        withDockerRegistry([credentialsId: 'dockerhub', url: 'https://index.docker.io/v1/']) {
                            sh 'echo "✅ Docker registry authentication successful"'
                        }
                    } catch (Exception e) {
                        error "❌ Docker registry authentication failed: ${e.getMessage()}"
                    }
                }
            }
        }
    }
}
EOF
    
    echo -e "${GREEN}✅ Test pipeline created at /tmp/jenkins-credential-test.groovy${NC}"
    echo -e "${BLUE}💡 Copy this pipeline to Jenkins to test credential configuration${NC}"
}

# Function to check current pipeline configuration
check_pipeline_config() {
    echo -e "${CYAN}📋 Current Pipeline Configuration Analysis${NC}"
    echo "=========================================="
    echo ""
    echo -e "${BLUE}From your pipeline logs, the issue is:${NC}"
    echo "• Pipeline reaches the 'Push to Registry' stage"
    echo "• withDockerRegistry step fails with 'Could not find credentials matching ****'"
    echo "• This means Jenkins cannot find a credential with ID 'dockerhub'"
    echo ""
    echo -e "${YELLOW}Expected Jenkinsfile configuration (which you have):${NC}"
    echo "withDockerRegistry([credentialsId: 'dockerhub', url: 'https://index.docker.io/v1/']) {"
    echo "    // Docker push commands"
    echo "}"
    echo ""
    echo -e "${RED}Missing: Jenkins credential with ID 'dockerhub'${NC}"
}

# Function to provide immediate fix
provide_immediate_fix() {
    echo -e "${CYAN}⚡ Immediate Fix Required${NC}"
    echo "========================="
    echo ""
    echo -e "${YELLOW}1. Add Docker Hub Credentials in Jenkins UI:${NC}"
    echo "   → Open: http://localhost:8080/credentials/store/system/domain/_/"
    echo "   → Click: Add Credentials"
    echo "   → Fill form with exact values shown above"
    echo ""
    echo -e "${YELLOW}2. Verify Credential ID:${NC}"
    echo "   → Must be exactly: dockerhub"
    echo "   → No spaces, no typos, case-sensitive"
    echo ""
    echo -e "${YELLOW}3. Test with the credential test pipeline${NC}"
    echo ""
    echo -e "${YELLOW}4. Re-run your main pipeline${NC}"
    echo ""
}

# Main execution
main() {
    check_jenkins_container
    echo ""
    check_credentials_structure
    echo ""
    check_jenkins_api_credentials
    echo ""
    check_credential_files
    echo ""
    test_docker_credentials_manual
    echo ""
    check_pipeline_config
    show_credential_config_steps
    create_credential_test
    provide_immediate_fix
    
    echo ""
    echo -e "${GREEN}🎉 Validation complete!${NC}"
    echo -e "${CYAN}💡 The issue is clear: Jenkins needs the 'dockerhub' credential configured${NC}"
}

# Run main function
main "$@"
