#!/bin/bash

# Comprehensive Credential Testing Suite
# This script runs all credential validation tests

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${BOLD}${BLUE}🔐 Comprehensive Jenkins Credential Testing Suite${NC}"
echo "=================================================="
echo ""

# Function to show menu
show_menu() {
    echo -e "${CYAN}Select testing option:${NC}"
    echo ""
    echo "1. 🐳 Test Docker Hub credentials only"
    echo "2. 🔧 Test all Jenkins credentials"
    echo "3. 🧪 Run comprehensive validation"
    echo "4. 📋 Generate test pipeline for Jenkins"
    echo "5. 🔍 Quick credential check"
    echo "6. 📖 Show manual validation guide"
    echo "7. 🚪 Exit"
    echo ""
    read -p "Enter your choice (1-7): " choice
}

# Function to test Docker Hub credentials
test_dockerhub_only() {
    echo -e "${BLUE}🐳 Running Docker Hub credential test...${NC}"
    echo ""
    ./scripts/test-dockerhub-credentials.sh
}

# Function to test all Jenkins credentials
test_all_jenkins_credentials() {
    echo -e "${BLUE}🔧 Running comprehensive Jenkins credential validation...${NC}"
    echo ""
    ./scripts/validate-jenkins-credentials.sh
}

# Function to run comprehensive validation
run_comprehensive_validation() {
    echo -e "${BLUE}🧪 Running comprehensive validation suite...${NC}"
    echo ""
    
    echo -e "${CYAN}Step 1: Jenkins Setup Verification${NC}"
    ./scripts/verify-jenkins-setup.sh
    echo ""
    
    echo -e "${CYAN}Step 2: Docker Hub Credential Testing${NC}"
    ./scripts/test-dockerhub-credentials.sh
    echo ""
    
    echo -e "${CYAN}Step 3: All Credential Validation${NC}"
    ./scripts/validate-jenkins-credentials.sh
}

# Function to generate test pipeline
generate_test_pipeline() {
    echo -e "${BLUE}📋 Generating Jenkins test pipeline...${NC}"
    echo ""
    
    cat > jenkins-credential-test-pipeline.groovy << 'EOF'
pipeline {
    agent any
    
    environment {
        DOCKER_IMAGE_NAME = "kushal493/credential-test"
        TEST_TAG = "${BUILD_NUMBER}-${env.BUILD_TIMESTAMP}"
    }
    
    stages {
        stage('Environment Check') {
            steps {
                echo "🔍 Checking build environment..."
                sh '''
                    echo "Jenkins Home: $JENKINS_HOME"
                    echo "Workspace: $WORKSPACE"
                    echo "Build Number: $BUILD_NUMBER"
                    echo "Docker version:"
                    docker --version
                '''
            }
        }
        
        stage('Test Docker Hub Credentials') {
            steps {
                echo "🐳 Testing Docker Hub credentials..."
                script {
                    try {
                        withDockerRegistry([credentialsId: 'dockerhub', url: 'https://index.docker.io/v1/']) {
                            sh '''
                                echo "✅ Docker Hub credentials loaded successfully"
                                echo "Testing docker info..."
                                docker info | head -10
                            '''
                        }
                        echo "✅ Docker Hub credentials test PASSED"
                    } catch (Exception e) {
                        error "❌ Docker Hub credentials test FAILED: ${e.getMessage()}"
                    }
                }
            }
        }
        
        stage('Test SSH Credentials') {
            steps {
                echo "🔐 Testing SSH credentials..."
                script {
                    try {
                        withCredentials([sshUserPrivateKey(credentialsId: 'ec2-ssh-key', keyFileVariable: 'SSH_KEY', usernameVariable: 'SSH_USER')]) {
                            sh '''
                                echo "✅ SSH credentials loaded successfully"
                                echo "SSH User: $SSH_USER"
                                echo "SSH Key file: $SSH_KEY"
                                echo "SSH Key exists: $(test -f $SSH_KEY && echo 'Yes' || echo 'No')"
                                if [ -f "$SSH_KEY" ]; then
                                    echo "SSH Key permissions: $(ls -la $SSH_KEY)"
                                fi
                            '''
                        }
                        echo "✅ SSH credentials test PASSED"
                    } catch (Exception e) {
                        echo "⚠️ SSH credentials not configured: ${e.getMessage()}"
                        echo "This is OK if you're not deploying to EC2"
                    }
                }
            }
        }
        
        stage('Test Environment Variables') {
            steps {
                echo "🌍 Testing environment variables..."
                sh '''
                    echo "Environment Variables:"
                    echo "EC2_HOST: ${EC2_HOST:-'Not set'}"
                    echo "EC2_USER: ${EC2_USER:-'Not set'}"
                    echo "NODE_ENV: ${NODE_ENV:-'Not set'}"
                '''
            }
        }
        
        stage('Test Docker Build and Push') {
            steps {
                echo "🏗️ Testing Docker build and push..."
                script {
                    try {
                        withDockerRegistry([credentialsId: 'dockerhub', url: 'https://index.docker.io/v1/']) {
                            sh '''
                                # Create a simple test Dockerfile
                                cat > Dockerfile.test << 'DOCKERFILE_EOF'
FROM alpine:latest
RUN echo "Jenkins credential test image"
RUN date > /test-timestamp
CMD echo "Credential test successful"
DOCKERFILE_EOF
                                
                                # Build test image
                                TEST_IMAGE="${DOCKER_IMAGE_NAME}:${TEST_TAG}"
                                echo "Building test image: $TEST_IMAGE"
                                docker build -f Dockerfile.test -t $TEST_IMAGE .
                                
                                # Push test image
                                echo "Pushing test image: $TEST_IMAGE"
                                docker push $TEST_IMAGE
                                
                                # Clean up
                                docker rmi $TEST_IMAGE
                                rm Dockerfile.test
                                
                                echo "✅ Docker build and push test PASSED"
                            '''
                        }
                    } catch (Exception e) {
                        error "❌ Docker build and push test FAILED: ${e.getMessage()}"
                    }
                }
            }
        }
    }
    
    post {
        always {
            echo "🧹 Cleaning up..."
            sh '''
                # Clean up any remaining test files
                rm -f Dockerfile.test
                
                # Clean up any dangling images
                docker image prune -f || true
            '''
        }
        success {
            echo "🎉 All credential tests PASSED!"
            echo "Your Jenkins setup is ready for deployment pipelines."
        }
        failure {
            echo "❌ Some credential tests FAILED!"
            echo "Please check the logs above and fix the issues."
        }
    }
}
EOF

    echo -e "${GREEN}✅ Test pipeline generated: jenkins-credential-test-pipeline.groovy${NC}"
    echo ""
    echo -e "${YELLOW}📋 To use this pipeline:${NC}"
    echo "1. Open Jenkins: http://localhost:8080"
    echo "2. Create a new Pipeline job"
    echo "3. Copy the content from jenkins-credential-test-pipeline.groovy"
    echo "4. Paste it into the Pipeline script section"
    echo "5. Run the pipeline to test all credentials"
    echo ""
}

# Function to run quick credential check
quick_credential_check() {
    echo -e "${BLUE}🔍 Running quick credential check...${NC}"
    echo ""
    
    # Check Jenkins status
    if docker ps | grep -q jenkins; then
        echo -e "${GREEN}✅ Jenkins is running${NC}"
    else
        echo -e "${RED}❌ Jenkins is not running${NC}"
        return 1
    fi
    
    # Quick Docker test
    if docker exec jenkins docker --version >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Docker is accessible in Jenkins${NC}"
    else
        echo -e "${RED}❌ Docker is not accessible in Jenkins${NC}"
    fi
    
    # Quick Docker Hub login test
    echo -e "${CYAN}Testing Docker Hub login...${NC}"
    if docker exec jenkins bash -c "
        echo 'dckr_pat_KPb1gKQLSGuQHTMhb67A7_kUlpQ' | docker login -u 'kushal493' --password-stdin >/dev/null 2>&1
        result=\$?
        docker logout >/dev/null 2>&1
        exit \$result
    " 2>/dev/null; then
        echo -e "${GREEN}✅ Docker Hub credentials are valid${NC}"
    else
        echo -e "${RED}❌ Docker Hub credentials are invalid${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}💡 For detailed testing, use options 1-3${NC}"
}

# Function to show manual validation guide
show_manual_guide() {
    echo -e "${BLUE}📖 Manual Credential Validation Guide${NC}"
    echo "====================================="
    echo ""
    echo -e "${CYAN}1. Docker Hub Credentials:${NC}"
    echo "   • Manual test: docker login -u kushal493"
    echo "   • Check token: https://hub.docker.com/settings/security"
    echo "   • Verify permissions: Read Public Repos, Write Public Repos"
    echo ""
    echo -e "${CYAN}2. Jenkins Credential Configuration:${NC}"
    echo "   • URL: http://localhost:8080"
    echo "   • Path: Manage Jenkins → Manage Credentials → System → Global"
    echo "   • Required ID: 'dockerhub' (exact match)"
    echo "   • Type: Username with password"
    echo ""
    echo -e "${CYAN}3. SSH Credentials (for EC2):${NC}"
    echo "   • Required ID: 'ec2-ssh-key'"
    echo "   • Type: SSH Username with private key"
    echo "   • Test: ssh -i [key] ec2-user@[host]"
    echo ""
    echo -e "${CYAN}4. Environment Variables:${NC}"
    echo "   • Path: Manage Jenkins → Configure System → Global Properties"
    echo "   • Required: EC2_HOST, EC2_USER"
    echo ""
    echo -e "${CYAN}5. Verification Commands:${NC}"
    echo "   • Jenkins logs: docker-compose -f docker-compose.jenkins.simple.yml logs -f"
    echo "   • Docker test: docker exec jenkins docker ps"
    echo "   • Credential test: Use option 4 to generate test pipeline"
}

# Main execution
main() {
    while true; do
        show_menu
        
        case $choice in
            1)
                test_dockerhub_only
                ;;
            2)
                test_all_jenkins_credentials
                ;;
            3)
                run_comprehensive_validation
                ;;
            4)
                generate_test_pipeline
                ;;
            5)
                quick_credential_check
                ;;
            6)
                show_manual_guide
                ;;
            7)
                echo -e "${GREEN}👋 Goodbye!${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}❌ Invalid option. Please try again.${NC}"
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
        echo ""
    done
}

# Run the main function
main "$@"
