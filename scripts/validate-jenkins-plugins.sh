#!/bin/bash

# Jenkins Plugin Validation Script
# This script validates Jenkins plugins before building the Docker image

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}🔍 Jenkins Plugin Validation Tool${NC}"
echo "=================================="
echo ""

# Function to check if plugins.txt exists
check_plugins_file() {
    if [ ! -f "plugins.txt" ]; then
        echo -e "${RED}❌ plugins.txt file not found${NC}"
        echo "Please create a plugins.txt file with your desired plugins"
        exit 1
    fi
    
    echo -e "${GREEN}✅ plugins.txt file found${NC}"
}

# Function to validate plugin format
validate_plugin_format() {
    echo -e "${CYAN}📋 Validating plugin format...${NC}"
    
    local total_lines=$(wc -l < plugins.txt)
    local comment_lines=$(grep -c '^#' plugins.txt || true)
    local empty_lines=$(grep -c '^$' plugins.txt || true)
    local plugin_lines=$((total_lines - comment_lines - empty_lines))
    
    echo "Total lines: $total_lines"
    echo "Comment lines: $comment_lines"
    echo "Empty lines: $empty_lines"
    echo "Plugin entries: $plugin_lines"
    
    if [ $plugin_lines -eq 0 ]; then
        echo -e "${RED}❌ No plugin entries found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Plugin format validation passed${NC}"
}

# Function to test plugin installation
test_plugin_installation() {
    echo -e "${CYAN}🧪 Testing plugin installation...${NC}"
    echo "This will create a temporary Jenkins container to test plugin installation"
    
    # Create a temporary Dockerfile for testing
    cat > Dockerfile.test << 'EOF'
FROM jenkins/jenkins:lts-jdk11
USER jenkins
COPY plugins.txt /usr/share/jenkins/ref/plugins.txt
RUN jenkins-plugin-cli \
    --plugin-file /usr/share/jenkins/ref/plugins.txt \
    --latest \
    --latest-specified \
    --verbose \
    --no-download
EOF
    
    echo "Building test image..."
    if docker build -f Dockerfile.test -t jenkins-plugin-test:latest . --quiet; then
        echo -e "${GREEN}✅ Plugin dependency test passed${NC}"
        
        # Clean up test image
        docker rmi jenkins-plugin-test:latest >/dev/null 2>&1 || true
        rm -f Dockerfile.test
    else
        echo -e "${RED}❌ Plugin dependency test failed${NC}"
        echo -e "${YELLOW}💡 Check for plugin compatibility issues${NC}"
        rm -f Dockerfile.test
        exit 1
    fi
}

# Function to check for known problematic plugins
check_problematic_plugins() {
    echo -e "${CYAN}⚠️ Checking for known problematic plugins...${NC}"
    
    # List of plugins known to cause issues
    local problematic_plugins=(
        "docker-pipeline"
        "pipeline-github-lib"
        "pam-auth"
        "ldap"
    )
    
    local found_issues=false
    
    for plugin in "${problematic_plugins[@]}"; do
        if grep -q "^$plugin" plugins.txt; then
            echo -e "${YELLOW}⚠️ Found potentially problematic plugin: $plugin${NC}"
            found_issues=true
        fi
    done
    
    if [ "$found_issues" = false ]; then
        echo -e "${GREEN}✅ No known problematic plugins found${NC}"
    else
        echo -e "${YELLOW}💡 Consider removing or replacing problematic plugins${NC}"
    fi
}

# Function to suggest essential plugins
suggest_essential_plugins() {
    echo -e "${CYAN}💡 Checking for essential plugins...${NC}"
    
    local essential_plugins=(
        "workflow-aggregator"
        "docker-workflow"
        "git"
        "credentials-binding"
        "pipeline-stage-view"
    )
    
    local missing_plugins=()
    
    for plugin in "${essential_plugins[@]}"; do
        if ! grep -q "^$plugin" plugins.txt; then
            missing_plugins+=("$plugin")
        fi
    done
    
    if [ ${#missing_plugins[@]} -eq 0 ]; then
        echo -e "${GREEN}✅ All essential plugins are included${NC}"
    else
        echo -e "${YELLOW}💡 Consider adding these essential plugins:${NC}"
        for plugin in "${missing_plugins[@]}"; do
            echo "  - $plugin"
        done
    fi
}

# Function to show plugin summary
show_plugin_summary() {
    echo -e "${CYAN}📊 Plugin Summary${NC}"
    echo "=================="
    
    echo "Plugins to be installed:"
    grep -v '^#' plugins.txt | grep -v '^$' | while read -r line; do
        echo "  ✓ $line"
    done
}

# Main execution
main() {
    check_plugins_file
    validate_plugin_format
    check_problematic_plugins
    suggest_essential_plugins
    
    echo ""
    echo -e "${CYAN}🧪 Would you like to test plugin installation? (y/N)${NC}"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        test_plugin_installation
    fi
    
    echo ""
    show_plugin_summary
    
    echo ""
    echo -e "${GREEN}🎉 Plugin validation completed!${NC}"
    echo -e "${CYAN}💡 You can now run: ./scripts/rebuild-jenkins-with-docker.sh${NC}"
}

# Run main function
main "$@"
