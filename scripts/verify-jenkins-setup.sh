#!/bin/bash

# Verify Jenkins Setup - Complete Verification
# This script verifies that Jenkins is properly configured with Docker support

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Verifying Jenkins Setup${NC}"
echo "================================"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TOTAL_TESTS=0

# Function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"

    ((TOTAL_TESTS++))
    echo -n "Testing $test_name: "

    if eval "$test_command" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

# Test 1: Jenkins container is running
run_test "Jenkins container" "docker ps | grep -q jenkins"

# Test 2: Jenkins web interface is accessible
run_test "Jenkins web interface" "curl -f -s http://localhost:8080/login"

# Test 3: Docker is accessible in Jenkins
run_test "Docker access in Jenkins" "docker exec jenkins docker --version"

# Test 4: Docker socket is mounted
run_test "Docker socket mount" "docker exec jenkins ls -la /var/run/docker.sock"

# Test 5: Jenkins can list Docker images
run_test "Docker images listing" "docker exec jenkins docker images"

# Test 6: Jenkins can run Docker commands
run_test "Docker run capability" "docker exec jenkins docker run --rm hello-world"

echo ""
echo "================================"
echo -e "${BLUE}📊 Test Results:${NC}"
echo "Total tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo ""
    echo -e "${GREEN}🎉 All tests passed! Jenkins is ready for deployment.${NC}"
    echo ""
    echo -e "${BLUE}📋 Jenkins Information:${NC}"
    echo "Jenkins URL: http://localhost:8080"

    if admin_password=$(docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword 2>/dev/null); then
        echo "Admin Password: $admin_password"
    else
        echo "Admin Password: <run: docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword>"
    fi

    echo ""
    echo -e "${BLUE}🔧 Docker Information in Jenkins:${NC}"
    docker exec jenkins docker --version

else
    echo ""
    echo -e "${RED}❌ Some tests failed. Jenkins may not be properly configured.${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Troubleshooting steps:${NC}"
    echo "1. Check Jenkins logs: docker-compose -f docker-compose.jenkins.simple.yml logs"
    echo "2. Restart Jenkins: docker-compose -f docker-compose.jenkins.simple.yml restart"
    echo "3. Re-run the fix script: ./scripts/fix-jenkins-docker.sh"
    echo "4. Check Docker daemon is running on host"
    echo "5. Verify Docker socket permissions: ls -la /var/run/docker.sock"
fi

echo ""
echo -e "${BLUE}💡 Next Steps (if all tests passed):${NC}"
echo "1. Open Jenkins: http://localhost:8080"
echo "2. Complete initial setup with admin password"
echo "3. Install Docker Pipeline plugin (if not already installed)"
echo "4. Configure credentials for Docker Hub and EC2"
echo "5. Run your OMS deployment pipeline"

exit $TESTS_FAILED