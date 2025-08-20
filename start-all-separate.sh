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
    docker-compose -f docker-compose.app.slim.yml down --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.jenkins.yml down --remove-orphans 2>/dev/null || true
    
    print_success "Cleanup completed"
}

# Function to wait for service health
wait_for_service() {
    local service_name=$1
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for $service_name to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f docker-compose.infra.slim.yml ps "$service_name" | grep -q "healthy"; then
            print_success "$service_name is healthy"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - $service_name not ready yet..."
        sleep 2
        ((attempt++))
    done
    
    print_error "$service_name failed to become healthy after $max_attempts attempts"
    return 1
}

# Function to start infrastructure services
start_infrastructure() {
    print_status "🏗️  Starting infrastructure services (Postgres, Kafka, Redis)..."
    
    # Start infrastructure services
    if docker-compose -f docker-compose.infra.slim.yml up -d; then
        print_success "Infrastructure services started"
    else
        print_error "Failed to start infrastructure services"
        exit 1
    fi
    
    # Wait for services to be healthy
    print_status "Waiting for infrastructure to initialize..."
    
    # Wait for postgres
    wait_for_service "postgres" || {
        print_warning "Postgres health check failed, but continuing..."
    }
    
    # Wait for redis
    wait_for_service "redis" || {
        print_warning "Redis health check failed, but continuing..."
    }
    
    # Give kafka more time to initialize
    print_status "Waiting for Kafka to initialize..."
    sleep 15
}

# Function to start application services
start_applications() {
    print_status "🚀 Starting application services..."
    
    if docker-compose -f docker-compose.app.slim.yml up -d; then
        print_success "Application services started"
    else
        print_error "Failed to start application services"
        exit 1
    fi
    
    # Wait a bit for services to start
    print_status "Waiting for application services to initialize..."
    sleep 15
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
    print_status "Application Services:"
    docker-compose -f docker-compose.app.slim.yml ps
    
    echo ""
    print_status "Jenkins:"
    docker-compose -f docker-compose.jenkins.yml ps
}

# Function to create Jenkins-only script
create_jenkins_script() {
    print_status "📝 Creating Jenkins-only startup script..."
    
    cat > start-apps-only.sh << 'EOF'
#!/bin/bash

# Script to start only application services (for Jenkins)
# Assumes infrastructure services are already running

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

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to check if network exists
check_network() {
    if ! docker network ls | grep -q "oms-network"; then
        print_error "Network 'oms-network' does not exist. Start infrastructure first."
        exit 1
    fi
    print_success "Network 'oms-network' exists"
}

# Function to check if required images exist
check_images() {
    print_status "Checking required images..."
    
    if ! docker image inspect oms-app-base:latest >/dev/null 2>&1; then
        print_error "Image 'oms-app-base:latest' not found. Build it first."
        exit 1
    fi
    print_success "Required images available"
}

# Function to start application services
start_apps() {
    print_status "🚀 Starting application services only..."
    
    # Check prerequisites
    check_docker
    check_network
    check_images
    
    # Start application services
    if docker-compose -f docker-compose.app.slim.yml up -d; then
        print_success "Application services started successfully"
    else
        print_error "Failed to start application services"
        exit 1
    fi
    
    print_status "Waiting for services to initialize..."
    sleep 10
    
    print_success "🎉 Application services are ready!"
    echo ""
    print_status "🌐 Services available at:"
    echo "  - API Gateway: http://localhost:3000"
    echo "  - Auth Service: http://localhost:3001"
    echo "  - Order Service: http://localhost:3002"
    echo "  - Inventory Service: http://localhost:3003"
    echo "  - Product Service: http://localhost:3004"
    echo "  - Cart Service: http://localhost:3005"
}

# Run the main function
start_apps "$@"
EOF

    chmod +x start-apps-only.sh
    print_success "Jenkins script created: start-apps-only.sh"
}

# Main execution
main() {
    print_status "🚀 Starting OMS Application Stack (Separate Mode)"
    echo "====================================================="
    
    # Check Docker
    check_docker
    
    # Check images
    check_images
    
    # Create network
    create_network
    
    # Cleanup existing
    cleanup_existing
    
    # Start infrastructure
    start_infrastructure
    
    # Start applications
    start_applications
    
    # Start Jenkins
    start_jenkins
    
    # Create Jenkins script
    create_jenkins_script
    
    # Show status
    show_status
    
    print_success "🎉 All services started successfully!"
    echo ""
    print_status "📋 Available scripts:"
    echo "  - ./start-all-separate.sh (start everything)"
    echo "  - ./start-apps-only.sh (start only apps - for Jenkins)"
    echo ""
    print_status "📊 Useful commands:"
    echo "  - View infra logs: docker-compose -f docker-compose.infra.slim.yml logs -f"
    echo "  - View app logs: docker-compose -f docker-compose.app.slim.yml logs -f"
    echo "  - Stop all: docker-compose -f docker-compose.infra.slim.yml down && docker-compose -f docker-compose.app.slim.yml down"
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
