#!/bin/bash

# Environment Validation Script for OMS Application
# This script validates the production environment configuration

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
ERRORS=0
WARNINGS=0
CHECKS=0

# Logging functions
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

success() {
    echo -e "${GREEN}[✅ PASS]${NC} $1"
    ((CHECKS++))
}

error() {
    echo -e "${RED}[❌ FAIL]${NC} $1"
    ((ERRORS++))
    ((CHECKS++))
}

warning() {
    echo -e "${YELLOW}[⚠️  WARN]${NC} $1"
    ((WARNINGS++))
    ((CHECKS++))
}

# Function to check if file exists
check_file() {
    local file="$1"
    local description="$2"

    if [[ -f "$file" ]]; then
        success "$description: $file"
        return 0
    else
        error "$description: $file (not found)"
        return 1
    fi
}

# Function to check if directory exists
check_directory() {
    local dir="$1"
    local description="$2"

    if [[ -d "$dir" ]]; then
        success "$description: $dir"
        return 0
    else
        error "$description: $dir (not found)"
        return 1
    fi
}

# Function to check environment variable
check_env_var() {
    local var_name="$1"
    local description="$2"
    local required="${3:-true}"

    if [[ -n "${!var_name:-}" ]]; then
        success "$description: $var_name is set"
        return 0
    else
        if [[ "$required" == "true" ]]; then
            error "$description: $var_name is not set"
        else
            warning "$description: $var_name is not set (optional)"
        fi
        return 1
    fi
}

# Function to check for insecure default values
check_secure_value() {
    local var_name="$1"
    local insecure_values=("${@:2}")

    local current_value="${!var_name:-}"

    for insecure_value in "${insecure_values[@]}"; do
        if [[ "$current_value" == "$insecure_value" ]]; then
            error "Security: $var_name is using insecure default value"
            return 1
        fi
    done

    success "Security: $var_name is not using default value"
    return 0
}

# Function to check minimum length
check_min_length() {
    local var_name="$1"
    local min_length="$2"
    local description="$3"

    local current_value="${!var_name:-}"

    if [[ ${#current_value} -ge $min_length ]]; then
        success "$description: $var_name has sufficient length (${#current_value} chars)"
        return 0
    else
        error "$description: $var_name is too short (${#current_value} chars, minimum $min_length)"
        return 1
    fi
}

# Function to check Docker
check_docker() {
    log "Checking Docker configuration..."

    # Check if Docker is installed
    if command -v docker >/dev/null 2>&1; then
        success "Docker is installed"
    else
        error "Docker is not installed"
        return 1
    fi

    # Check if Docker is running
    if docker info >/dev/null 2>&1; then
        success "Docker daemon is running"
    else
        error "Docker daemon is not running"
        return 1
    fi

    # Check if Docker Compose is installed
    if command -v docker-compose >/dev/null 2>&1; then
        success "Docker Compose is installed"
    else
        error "Docker Compose is not installed"
        return 1
    fi

    # Check Docker version
    local docker_version=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    log "Docker version: $docker_version"

    # Check Docker Compose version
    local compose_version=$(docker-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    log "Docker Compose version: $compose_version"
}

# Function to check system resources
check_system_resources() {
    log "Checking system resources..."

    # Check available memory
    local available_memory=$(free -m | awk 'NR==2{printf "%.1f", $7/1024}')
    log "Available memory: ${available_memory}GB"

    if (( $(echo "$available_memory > 0.5" | bc -l) )); then
        success "Sufficient memory available"
    else
        warning "Low memory available: ${available_memory}GB"
    fi

    # Check disk space
    local available_disk=$(df -h / | awk 'NR==2{print $4}')
    local available_disk_gb=$(df -BG / | awk 'NR==2{print $4}' | sed 's/G//')
    log "Available disk space: $available_disk"

    if [[ $available_disk_gb -gt 2 ]]; then
        success "Sufficient disk space available"
    else
        warning "Low disk space available: $available_disk"
    fi

    # Check CPU cores
    local cpu_cores=$(nproc)
    log "CPU cores: $cpu_cores"

    if [[ $cpu_cores -ge 1 ]]; then
        success "Sufficient CPU cores available"
    else
        error "Insufficient CPU cores"
    fi
}

# Function to validate network connectivity
check_network() {
    log "Checking network connectivity..."

    # Check internet connectivity
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        success "Internet connectivity is available"
    else
        error "No internet connectivity"
        return 1
    fi

    # Check Docker Hub connectivity
    if curl -f -s https://hub.docker.com >/dev/null 2>&1; then
        success "Docker Hub is accessible"
    else
        warning "Docker Hub is not accessible"
    fi

    # Check if required ports are available
    local required_ports=(3000 3001 3002 3003 3004 3005 5432 6379 9092)

    for port in "${required_ports[@]}"; do
        if ! netstat -tuln | grep ":$port " >/dev/null 2>&1; then
            success "Port $port is available"
        else
            warning "Port $port is already in use"
        fi
    done
}

# Main validation function
main() {
    echo "========================================"
    echo "OMS Environment Validation"
    echo "========================================"
    echo ""

    log "Starting environment validation..."
    echo ""

    # Check required files
    log "Checking required files..."
    check_file ".env" "Environment file"
    check_file "docker-compose.app.slim.yml" "Application compose file"
    check_file "docker-compose.infra.slim.yml" "Infrastructure compose file"
    check_file "Dockerfile" "Application Dockerfile"
    check_file "deploy.sh" "Deployment script"
    echo ""

    # Check required directories
    log "Checking required directories..."
    check_directory "scripts" "Scripts directory"
    check_directory "config" "Configuration directory"
    echo ""

    # Load environment variables if .env exists
    if [[ -f ".env" ]]; then
        log "Loading environment variables from .env..."
        set -a
        source .env
        set +a
        success "Environment variables loaded"
    else
        error "Cannot load environment variables - .env file not found"
        exit 1
    fi
    echo ""

    # Check required environment variables
    log "Checking required environment variables..."
    check_env_var "NODE_ENV" "Node environment"
    check_env_var "DOCKER_IMAGE_NAME" "Docker image name"
    check_env_var "POSTGRES_PASSWORD" "PostgreSQL password"
    check_env_var "DB_PASSWORD" "Database password"
    check_env_var "JWT_SECRET" "JWT secret"
    check_env_var "REDIS_HOST" "Redis host"
    check_env_var "KAFKA_BROKERS" "Kafka brokers"
    echo ""

    # Check optional environment variables
    log "Checking optional environment variables..."
    check_env_var "DOCKERHUB_USERNAME" "Docker Hub username" false
    check_env_var "EC2_HOST" "EC2 host" false
    echo ""

    # Check for insecure default values
    log "Checking for insecure default values..."
    check_secure_value "POSTGRES_PASSWORD" "postgres" "password" "123456"
    check_secure_value "DB_PASSWORD" "postgres" "password" "123456"
    check_secure_value "JWT_SECRET" "sec1234" "secret" "your_jwt_secret"
    echo ""

    # Check minimum lengths for security
    log "Checking security requirements..."
    check_min_length "JWT_SECRET" 32 "JWT secret length"
    check_min_length "POSTGRES_PASSWORD" 8 "PostgreSQL password length"
    echo ""

    # Check Docker configuration
    check_docker
    echo ""

    # Check system resources
    check_system_resources
    echo ""

    # Check network connectivity
    check_network
    echo ""

    # Summary
    echo "========================================"
    echo "Validation Summary"
    echo "========================================"
    echo "Total checks: $CHECKS"
    echo -e "Passed: ${GREEN}$((CHECKS - ERRORS - WARNINGS))${NC}"
    echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
    echo -e "Errors: ${RED}$ERRORS${NC}"
    echo ""

    if [[ $ERRORS -gt 0 ]]; then
        echo -e "${RED}❌ Environment validation failed with $ERRORS error(s)${NC}"
        echo "Please fix the errors above before proceeding with deployment."
        exit 1
    elif [[ $WARNINGS -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  Environment validation completed with $WARNINGS warning(s)${NC}"
        echo "Consider addressing the warnings above for optimal deployment."
        exit 0
    else
        echo -e "${GREEN}✅ Environment validation passed successfully!${NC}"
        echo "Your environment is ready for deployment."
        exit 0
    fi
}

# Execute main function
main "$@"