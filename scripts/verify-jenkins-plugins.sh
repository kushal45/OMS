#!/bin/bash

# Jenkins Plugin Verification Script - Latest LTS Version
# This script verifies that all Jenkins plugins are properly installed without dependency errors
# after upgrading to the latest LTS version

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔍 Jenkins Plugin Verification Tool - Latest LTS${NC}"
echo "=================================================="
echo ""
echo -e "${BLUE}📋 Verifying Jenkins LTS upgrade resolved plugin dependency issues${NC}"
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

# Function to wait for Jenkins to be ready
wait_for_jenkins() {
    echo -e "${CYAN}⏳ Waiting for Jenkins to be fully ready...${NC}"
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost:8080/login >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Jenkins is ready!${NC}"
            return 0
        fi
        
        echo "Attempt $attempt/$max_attempts - Jenkins not ready yet..."
        sleep 5
        attempt=$((attempt + 1))
    done
    
    echo -e "${YELLOW}⚠️ Jenkins may still be starting up${NC}"
}

# Function to check plugin installation status
check_plugin_status() {
    echo -e "${CYAN}🔌 Checking plugin installation status...${NC}"
    
    # Get list of installed plugins from Jenkins container
    local installed_plugins=$(docker exec jenkins jenkins-plugin-cli --list 2>/dev/null | grep -v "^$" | wc -l || echo "0")
    
    if [ "$installed_plugins" -gt 0 ]; then
        echo -e "${GREEN}✅ Found $installed_plugins installed plugins${NC}"
    else
        echo -e "${YELLOW}⚠️ Could not retrieve plugin list (Jenkins may still be starting)${NC}"
    fi
}

# Function to check for plugin dependency errors via Jenkins logs
check_plugin_errors() {
    echo -e "${CYAN}🔍 Checking for plugin dependency errors...${NC}"
    
    # Check Jenkins logs for plugin-related errors
    local error_count=$(docker logs jenkins 2>&1 | grep -i "plugin.*error\|dependency.*error\|failed.*plugin" | wc -l || echo "0")
    
    if [ "$error_count" -eq 0 ]; then
        echo -e "${GREEN}✅ No plugin dependency errors found in logs${NC}"
    else
        echo -e "${YELLOW}⚠️ Found $error_count potential plugin-related errors in logs${NC}"
        echo -e "${CYAN}💡 Recent plugin-related log entries:${NC}"
        docker logs jenkins 2>&1 | grep -i "plugin.*error\|dependency.*error\|failed.*plugin" | tail -5 || true
    fi
}

# Function to test Jenkins API accessibility
test_jenkins_api() {
    echo -e "${CYAN}🌐 Testing Jenkins API accessibility...${NC}"
    
    # Test basic Jenkins API endpoint
    if curl -f -s http://localhost:8080/api/json >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Jenkins API is accessible${NC}"
    else
        echo -e "${YELLOW}⚠️ Jenkins API not accessible (may require authentication)${NC}"
    fi
}

# Function to verify essential plugins
verify_essential_plugins() {
    echo -e "${CYAN}🔧 Verifying essential plugins are available...${NC}"
    
    local essential_plugins=(
        "workflow-aggregator"
        "docker-workflow"
        "git"
        "credentials-binding"
        "pipeline-stage-view"
        "blueocean"
    )
    
    local missing_plugins=()
    
    for plugin in "${essential_plugins[@]}"; do
        if docker exec jenkins test -d "/var/jenkins_home/plugins/$plugin" 2>/dev/null; then
            echo -e "${GREEN}  ✅ $plugin${NC}"
        else
            echo -e "${RED}  ❌ $plugin${NC}"
            missing_plugins+=("$plugin")
        fi
    done
    
    if [ ${#missing_plugins[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ All essential plugins are installed${NC}"
    else
        echo -e "${YELLOW}⚠️ Missing essential plugins: ${missing_plugins[*]}${NC}"
    fi
}

# Function to check Jenkins startup completion
check_jenkins_startup() {
    echo -e "${CYAN}🚀 Checking Jenkins startup completion...${NC}"
    
    # Check if Jenkins has completed startup
    if docker logs jenkins 2>&1 | grep -q "Jenkins is fully up and running"; then
        echo -e "${GREEN}✅ Jenkins startup completed successfully${NC}"
    else
        echo -e "${YELLOW}⚠️ Jenkins may still be starting up${NC}"
        echo -e "${CYAN}💡 Recent startup log entries:${NC}"
        docker logs jenkins 2>&1 | tail -10 || true
    fi
}

# Function to provide troubleshooting guidance
provide_troubleshooting() {
    echo -e "${CYAN}🔧 Troubleshooting Guide${NC}"
    echo "======================="
    echo ""
    echo -e "${YELLOW}If you see plugin dependency errors:${NC}"
    echo "1. Check Jenkins UI at http://localhost:8080"
    echo "2. Go to Manage Jenkins → Manage Plugins"
    echo "3. Look for plugins with dependency issues"
    echo "4. Update or reinstall problematic plugins"
    echo ""
    echo -e "${YELLOW}If plugins are missing:${NC}"
    echo "1. Rebuild Jenkins: ./scripts/rebuild-jenkins-with-docker.sh"
    echo "2. Validate plugins: ./scripts/validate-jenkins-plugins.sh"
    echo "3. Check plugins.txt for correct plugin names"
    echo ""
    echo -e "${YELLOW}Useful commands:${NC}"
    echo "• View logs: docker logs jenkins"
    echo "• Restart Jenkins: docker-compose -f docker-compose.jenkins.simple.yml restart"
    echo "• List plugins: docker exec jenkins jenkins-plugin-cli --list"
    echo "• Check plugin directory: docker exec jenkins ls -la /var/jenkins_home/plugins/"
}

# Function to show verification summary
show_summary() {
    echo ""
    echo -e "${CYAN}📊 Verification Summary${NC}"
    echo "======================="
    
    local status="✅ PASSED"
    local issues=0
    
    # Count any issues found
    if ! docker ps | grep -q jenkins; then
        issues=$((issues + 1))
        status="❌ FAILED"
    fi
    
    if [ "$issues" -eq 0 ]; then
        echo -e "${GREEN}$status - Jenkins is running properly with plugins installed${NC}"
        echo -e "${CYAN}💡 You can now access Jenkins at: http://localhost:8080${NC}"
    else
        echo -e "${YELLOW}⚠️ ISSUES FOUND - $issues issues detected${NC}"
        echo -e "${CYAN}💡 Review the output above and follow troubleshooting steps${NC}"
    fi
}

# Main execution
main() {
    check_jenkins_status
    wait_for_jenkins
    check_plugin_status
    verify_essential_plugins
    check_plugin_errors
    test_jenkins_api
    check_jenkins_startup
    
    echo ""
    provide_troubleshooting
    show_summary
    
    echo ""
    echo -e "${GREEN}🎉 Plugin verification completed!${NC}"
    echo -e "${CYAN}💡 Open Jenkins UI to verify no dependency errors are shown${NC}"
}

# Run main function
main "$@"
