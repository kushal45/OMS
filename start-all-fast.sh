#!/bin/bash

# Exit on any error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop first."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to create external network
create_network() {
    print_status "🌐 Creating external network..."
    
    if ! docker network ls | grep -q "oms-network"; then
        docker network create oms-network
        print_success "Network 'oms-network' created"
    else
        print_status "Network 'oms-network' already exists"
    fi
}

# Function to check if required images exist locally
check_images() {
    print_status "🔍 Checking required Docker images..."
    
    local images=(
        "postgres:14-alpine"
        "confluentinc/cp-kafka:latest"
        "redis:7.2-alpine"
        "oms-app-base:latest"
    )
    
    local missing_images=()
    
    for image in "${images[@]}"; do
        if ! docker image inspect "$image" >/dev/null 2>&1; then
            missing_images+=("$image")
        fi
    done
    
    if [ ${#missing_images[@]} -gt 0 ]; then
        print_warning "Missing images: ${missing_images[*]}"
        print_status "Attempting to pull/build missing images..."
        
        for image in "${missing_images[@]}"; do
            if [[ "$image" == "oms-app-base:latest" ]]; then
                print_status "Building local image: $image"
                docker build -t "$image" . || {
                    print_error "Failed to build $image"
                    print_status "💡 Make sure you have all dependencies installed (npm install)"
                    exit 1
                }
            else
                print_status "Pulling image: $image"
                docker pull "$image" || {
                    print_error "Failed to pull $image. You may need to log into Docker Hub."
                    print_status "Run: docker login"
                    exit 1
                }
            fi
        done
    else
        print_success "All required images are available"
    fi
}

# Function to clean up any existing containers
cleanup_existing() {
    print_status "🧹 Cleaning up existing containers..."
    
    # Stop and remove containers from all compose files
    docker-compose -f docker-compose.infra.slim.yml down --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.kafka-fast.yml down --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.app.slim.yml down --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.jenkins.yml down --remove-orphans 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Function to wait for service health with better error handling
wait_for_service() {
    local service_name=$1
    local compose_file=$2
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f "$compose_file" ps "$service_name" | grep -q "healthy"; then
            print_success "$service_name is healthy"
            return 0
        fi
        
        # Check if container is running but not healthy
        if docker-compose -f "$compose_file" ps "$service_name" | grep -q "Up"; then
            print_status "Attempt $attempt/$max_attempts - $service_name is running but not healthy yet..."
        else
            print_status "Attempt $attempt/$max_attempts - $service_name not running yet..."
        fi
        
        sleep 3
        ((attempt++))
    done
    
    print_error "$service_name failed to become healthy after $max_attempts attempts"
    return 1
}

# Function to wait for Kafka to be fully ready (fast version)
wait_for_kafka_fast() {
    print_status "⏳ Waiting for Kafka to be fully ready (fast mode)..."
    
    local max_attempts=15
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        # Try to connect to Kafka and list topics
        if docker exec kafka-fast kafka-topics --bootstrap-server localhost:9092 --list >/dev/null 2>&1; then
            print_success "Kafka is fully ready and accepting connections"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - Kafka not ready yet..."
        sleep 5
        ((attempt++))
    done
    
    print_warning "Kafka health check timed out, but continuing..."
    return 1
}

# Function to start infrastructure services with fast Kafka
start_infrastructure_fast() {
    print_status "🏗️  Starting infrastructure services with fast Kafka..."
    
    # Start postgres and redis
    print_status "Starting Postgres and Redis..."
    docker-compose -f docker-compose.infra.slim.yml up -d postgres redis
    
    # Wait for postgres and redis
    wait_for_service "postgres" "docker-compose.infra.slim.yml" || {
        print_warning "Postgres health check failed, but continuing..."
    }
    
    wait_for_service "redis" "docker-compose.infra.slim.yml" || {
        print_warning "Redis health check failed, but continuing..."
    }
    
    # Start fast Kafka
    print_status "Starting fast Kafka..."
    docker-compose -f docker-compose.kafka-fast.yml up -d
    
    # Wait for Kafka to be ready
    wait_for_kafka_fast
}

# Function to start application services with retry logic
start_applications() {
    print_status "🚀 Starting application services..."
    
    # First attempt to start all services
    if docker-compose -f docker-compose.app.slim.yml up -d; then
        print_success "Application services started"
    else
        print_warning "Some application services failed to start, will retry..."
        
        # Wait a bit more for Kafka
        print_status "Waiting additional time for Kafka to be ready..."
        sleep 15
        
        # Retry starting services
        if docker-compose -f docker-compose.app.slim.yml up -d; then
            print_success "Application services started on retry"
        else
            print_error "Failed to start application services even after retry"
            exit 1
        fi
    fi
    
    # Wait for services to stabilize
    print_status "Waiting for application services to stabilize..."
    sleep 10
}

# Function to start Jenkins
start_jenkins() {
    print_status "🔧 Starting Jenkins..."
    
    if docker-compose -f docker-compose.jenkins.yml up -d; then
        print_success "Jenkins started"
    else
        print_warning "Failed to start Jenkins (this is optional)"
    fi
}

# Function to show service status
show_status() {
    print_status "Service Status:"
    echo "=================="
    
    print_status "Infrastructure Services:"
    docker-compose -f docker-compose.infra.slim.yml ps
    
    echo ""
    print_status "Fast Kafka:"
    docker-compose -f docker-compose.kafka-fast.yml ps
    
    echo ""
    print_status "Application Services:"
    docker-compose -f docker-compose.app.slim.yml ps
    
    echo ""
    print_status "Jenkins:"
    docker-compose -f docker-compose.jenkins.yml ps
}

# Function to check for failed services
check_failed_services() {
    print_status "🔍 Checking for failed services..."
    
    local failed_services=()
    
    # Check infrastructure services
    if docker-compose -f docker-compose.infra.slim.yml ps | grep -q "Exit"; then
        failed_services+=("infrastructure")
    fi
    
    # Check Kafka
    if docker-compose -f docker-compose.kafka-fast.yml ps | grep -q "Exit"; then
        failed_services+=("kafka")
    fi
    
    # Check application services
    if docker-compose -f docker-compose.app.slim.yml ps | grep -q "Exit"; then
        failed_services+=("application")
    fi
    
    if [ ${#failed_services[@]} -gt 0 ]; then
        print_warning "Some services failed: ${failed_services[*]}"
        print_status "You can check logs with: docker-compose -f docker-compose.app.slim.yml logs"
        return 1
    else
        print_success "All services appear to be running"
        return 0
    fi
}

# Main execution
main() {
    print_status "🚀 Starting OMS Application Stack (Fast Mode)"
    echo "====================================================="
    
    # Check Docker
    check_docker
    
    # Check images
    check_images
    
    # Create network
    create_network
    
    # Cleanup existing
    cleanup_existing
    
    # Start infrastructure with fast Kafka
    start_infrastructure_fast
    
    # Start applications
    start_applications
    
    # Start Jenkins
    start_jenkins
    
    # Check for failed services
    check_failed_services
    
    # Show status
    show_status
    
    print_success "🎉 All services started successfully!"
    echo ""
    print_status "📊 Useful commands:"
    echo "  - View infra logs: docker-compose -f docker-compose.infra.slim.yml logs -f"
    echo "  - View kafka logs: docker-compose -f docker-compose.kafka-fast.yml logs -f"
    echo "  - View app logs: docker-compose -f docker-compose.app.slim.yml logs -f"
    echo "  - Stop all: docker-compose -f docker-compose.infra.slim.yml down && docker-compose -f docker-compose.kafka-fast.yml down && docker-compose -f docker-compose.app.slim.yml down"
    echo "  - Restart: ./start-all-fast.sh"
    echo ""
    print_status "🌐 Services available at:"
    echo "  - API Gateway: http://localhost:3000"
    echo "  - Auth Service: http://localhost:3001"
    echo "  - Order Service: http://localhost:3002"
    echo "  - Inventory Service: http://localhost:3003"
    echo "  - Product Service: http://localhost:3004"
    echo "  - Cart Service: http://localhost:3005"
    echo "  - PostgreSQL: localhost:5433"
    echo "  - Redis: localhost:6379"
    echo "  - Kafka: localhost:9092"
}

# Run the main function
main "$@"
