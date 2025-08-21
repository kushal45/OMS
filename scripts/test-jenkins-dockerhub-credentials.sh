#!/bin/bash

# Test Jenkins Docker Hub Credentials Script
# This script tests if the dockerhub credentials are properly configured in Jenkins

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🧪 Testing Jenkins Docker Hub Credentials${NC}"
echo "=========================================="
echo ""

# Function to test credentials via Jenkins CLI
test_credentials_via_cli() {
    echo -e "${CYAN}🔍 Testing credentials via Jenkins container...${NC}"
    
    # Create a test script inside Jenkins container
    docker exec jenkins sh -c 'cat > /tmp/test-creds.groovy << '"'"'EOF'"'"'
import jenkins.model.*
import com.cloudbees.plugins.credentials.*
import com.cloudbees.plugins.credentials.common.*
import com.cloudbees.plugins.credentials.domains.*
import com.cloudbees.plugins.credentials.impl.*

def jenkins = Jenkins.getInstance()
def domain = Domain.global()
def store = jenkins.getExtensionList("com.cloudbees.plugins.credentials.SystemCredentialsProvider")[0].getStore()

println "=== Checking for dockerhub credential ==="

def credentials = store.getCredentials(domain)
def found = false

credentials.each { cred ->
    if (cred.getId() == "dockerhub") {
        found = true
        println "✅ Found credential with ID: dockerhub"
        println "   Type: " + cred.getClass().getSimpleName()
        println "   Description: " + (cred.getDescription() ?: "No description")
        if (cred instanceof UsernamePasswordCredentials) {
            println "   Username: " + cred.getUsername()
            println "   Password length: " + cred.getPassword().getPlainText().length()
        }
    }
}

if (!found) {
    println "❌ No credential found with ID: dockerhub"
    println "Available credentials:"
    credentials.each { cred ->
        println "   - ID: " + cred.getId() + " (Type: " + cred.getClass().getSimpleName() + ")"
    }
}

println "=== Test complete ==="
EOF'
    
    # Run the test script
    echo -e "${BLUE}📋 Running credential test script...${NC}"
    if docker exec jenkins java -jar /var/jenkins_home/war/WEB-INF/jenkins-cli.jar -s http://localhost:8080/ groovy /tmp/test-creds.groovy 2>/dev/null; then
        echo -e "${GREEN}✅ Credential test script executed successfully${NC}"
    else
        echo -e "${YELLOW}⚠️ Could not run credential test script (may require authentication)${NC}"
        
        # Alternative: Check credentials.xml directly
        echo -e "${BLUE}📋 Checking credentials.xml directly...${NC}"
        if docker exec jenkins grep -A 5 -B 5 "dockerhub" /var/jenkins_home/credentials.xml 2>/dev/null; then
            echo -e "${GREEN}✅ Found 'dockerhub' in credentials.xml${NC}"
        else
            echo -e "${RED}❌ 'dockerhub' not found in credentials.xml${NC}"
        fi
    fi
}

# Function to test with a simple pipeline
test_with_pipeline() {
    echo -e "${CYAN}🚀 Testing with a simple pipeline...${NC}"
    
    # Create a minimal test pipeline
    cat > /tmp/docker-cred-test.groovy << 'EOF'
pipeline {
    agent any
    
    stages {
        stage('Test Docker Credentials') {
            steps {
                script {
                    try {
                        echo "🔍 Testing dockerhub credential access..."
                        
                        withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                            echo "✅ SUCCESS: Credential 'dockerhub' is accessible"
                            echo "Username: ${DOCKER_USER}"
                            echo "Password length: ${DOCKER_PASS.length()}"
                        }
                        
                        echo "🐳 Testing Docker registry authentication..."
                        withDockerRegistry([credentialsId: 'dockerhub', url: 'https://index.docker.io/v1/']) {
                            sh 'echo "✅ SUCCESS: Docker registry authentication works"'
                        }
                        
                    } catch (Exception e) {
                        error "❌ FAILED: ${e.getMessage()}"
                    }
                }
            }
        }
    }
}
EOF
    
    echo -e "${GREEN}✅ Test pipeline created at /tmp/docker-cred-test.groovy${NC}"
    echo -e "${BLUE}💡 Copy this pipeline to Jenkins and run it to test credentials${NC}"
}

# Function to show current credential status
show_credential_status() {
    echo -e "${CYAN}📊 Current Credential Status${NC}"
    echo "============================="
    echo ""
    
    # Check credentials.xml modification time
    local cred_time=$(docker exec jenkins stat -c %Y /var/jenkins_home/credentials.xml 2>/dev/null || echo "unknown")
    local current_time=$(date +%s)
    local time_diff=$((current_time - cred_time))
    
    if [[ "$cred_time" != "unknown" ]]; then
        echo -e "${BLUE}📅 credentials.xml last modified: $(docker exec jenkins date -d @${cred_time} 2>/dev/null || echo "unknown")${NC}"
        if [[ $time_diff -lt 300 ]]; then
            echo -e "${GREEN}✅ Credentials file was recently updated (within 5 minutes)${NC}"
        else
            echo -e "${YELLOW}⚠️ Credentials file was not recently updated${NC}"
        fi
    fi
    
    # Check file size
    local file_size=$(docker exec jenkins stat -c %s /var/jenkins_home/credentials.xml 2>/dev/null || echo "0")
    echo -e "${BLUE}📏 credentials.xml size: ${file_size} bytes${NC}"
    
    if [[ $file_size -gt 1000 ]]; then
        echo -e "${GREEN}✅ Credentials file has substantial content${NC}"
    else
        echo -e "${YELLOW}⚠️ Credentials file seems small${NC}"
    fi
}

# Function to provide next steps
provide_next_steps() {
    echo -e "${CYAN}🎯 Next Steps${NC}"
    echo "============="
    echo ""
    echo -e "${YELLOW}1. Test the credentials:${NC}"
    echo "   → Copy the test pipeline from /tmp/docker-cred-test.groovy"
    echo "   → Create a new Pipeline job in Jenkins"
    echo "   → Run the test pipeline"
    echo ""
    echo -e "${YELLOW}2. If test passes:${NC}"
    echo "   → Re-run your main pipeline"
    echo "   → The Docker push should now work"
    echo ""
    echo -e "${YELLOW}3. If test fails:${NC}"
    echo "   → Check the credential ID is exactly 'dockerhub'"
    echo "   → Verify the credential scope is 'Global'"
    echo "   → Re-add the credentials if needed"
    echo ""
    echo -e "${BLUE}💡 Quick test: Run your main pipeline again to see if it works now${NC}"
}

# Main execution
main() {
    show_credential_status
    echo ""
    test_credentials_via_cli
    echo ""
    test_with_pipeline
    echo ""
    provide_next_steps
    
    echo ""
    echo -e "${GREEN}🎉 Credential validation complete!${NC}"
    echo -e "${CYAN}💡 Try running your main pipeline now${NC}"
}

# Run main function
main "$@"
