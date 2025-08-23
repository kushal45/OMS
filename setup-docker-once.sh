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

# Function to check if setup is already done
check_setup_status() {
    local setup_file=".docker-setup-complete"
    if [ -f "$setup_file" ]; then
        print_status "Docker setup already completed. Skipping setup..."
        return 0
    fi
    return 1
}

# Function to mark setup as complete
mark_setup_complete() {
    echo "$(date): Docker setup completed successfully" > .docker-setup-complete
    print_success "Setup marked as complete"
}

# Function to handle Docker login with retry
handle_docker_login() {
    print_status "🔐 Setting up Docker authentication..."
    
    # Check if already logged in
    if docker info 2>/dev/null | grep -q "Username"; then
        print_success "Already logged into Docker Hub"
        return 0
    fi
    
    # Try to login
    print_status "Attempting Docker Hub login..."
    if docker login; then
        print_success "Docker Hub login successful"
        return 0
    else
        print_warning "Docker login failed or was cancelled"
        print_status "You can still use public images without login"
        return 1
    fi
}

# Function to pull all required images once
pull_all_images() {
    print_status "📦 Pulling all required Docker images (one-time operation)..."
    
    local images=(
        "postgres:14-alpine"
        "confluentinc/cp-kafka:latest"
        "redis:7.2-alpine"
    )
    
    local failed_images=()
    
    for image in "${images[@]}"; do
        print_status "Pulling $image..."
        if docker pull "$image" >/dev/null 2>&1; then
            print_success "✅ $image pulled successfully"
        else
            print_warning "⚠️  Failed to pull $image"
            failed_images+=("$image")
        fi
    done
    
    if [ ${#failed_images[@]} -gt 0 ]; then
        print_warning "Some images failed to pull: ${failed_images[*]}"
        print_status "These will be pulled automatically when needed"
    fi
}

# Function to build local images
build_local_images() {
    print_status "🔨 Building local application images..."
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        print_status "Installing npm dependencies..."
        npm install
    fi
    
    # Build the base app image
    print_status "Building oms-app-base:latest..."
    if docker build -t oms-app-base:latest . >/dev/null 2>&1; then
        print_success "✅ oms-app-base:latest built successfully"
    else
        print_error "❌ Failed to build oms-app-base:latest"
        print_status "💡 Make sure you have all dependencies installed"
        exit 1
    fi
}

# Function to create image cache verification
create_image_cache() {
    print_status "📋 Creating image cache verification..."
    
    local cache_file=".docker-images-cache"
    local images=(
        "postgres:14-alpine"
        "confluentinc/cp-kafka:latest"
        "redis:7.2-alpine"
        "oms-app-base:latest"
    )
    
    echo "# Docker Images Cache - Generated on $(date)" > "$cache_file"
    echo "# This file helps verify that all required images are available" >> "$cache_file"
    
    for image in "${images[@]}"; do
        if docker image inspect "$image" >/dev/null 2>&1; then
            echo "AVAILABLE: $image" >> "$cache_file"
        else
            echo "MISSING: $image" >> "$cache_file"
        fi
    done
    
    print_success "Image cache verification created"
}

# Function to verify all images are available
verify_images() {
    print_status "🔍 Verifying all required images are available..."
    
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
        return 1
    else
        print_success "All required images are available"
        return 0
    fi
}

# Function to create optimized start script
create_optimized_start_script() {
    print_status "🚀 Creating optimized start script..."
    
    cat > start-all-optimized.sh << 'EOF'
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

# Function to verify images are available (fast check)
verify_images_fast() {
    print_status "🔍 Verifying images (fast check)..."
    
    local images=(
        "postgres:14-alpine"
        "confluentinc/cp-kafka:latest"
        "redis:7.2-alpine"
        "oms-app-base:latest"
    )
    
    for image in "${images[@]}"; do
        if ! docker image inspect "$image" >/dev/null 2>&1; then
            print_error "Missing image: $image"
            print_status "Run ./setup-docker-once.sh to set up images"
            exit 1
        fi
    done
    
    print_success "All images verified"
}

# Function to start services
start_services() {
    print_status "🚀 Starting OMS Application Stack"
    echo "======================================"
    
    # Check Docker
    check_docker
    
    # Fast image verification
    verify_images_fast
    
    # Start infrastructure
    print_status "Starting infrastructure services..."
    docker-compose -f docker-compose.infra.slim.yml up -d
    
    # Wait for services
    print_status "Waiting for infrastructure to initialize..."
    sleep 20
    
    # Start applications
    print_status "Starting application services..."
    docker-compose -f docker-compose.app.slim.yml up -d
    
    # Start Jenkins
    print_status "Starting Jenkins..."
    docker-compose -f docker-compose.jenkins.yml up -d
    
    print_success "🎉 All services started successfully!"
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
start_services "$@"
EOF

    chmod +x start-all-optimized.sh
    print_success "Optimized start script created: start-all-optimized.sh"
}

# Main execution
main() {
    print_status "🔧 One-Time Docker Setup"
    echo "============================"
    
    # Check if already set up
    if check_setup_status; then
        print_status "Setup already completed. Run ./start-all-optimized.sh to start services."
        exit 0
    fi
    
    # Check Docker
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker Desktop first."
        exit 1
    fi
    
    # Handle Docker login
    handle_docker_login
    
    # Pull all images
    pull_all_images
    
    # Build local images
    build_local_images
    
    # Create image cache
    create_image_cache
    
    # Verify all images
    if verify_images; then
        # Create optimized start script
        create_optimized_start_script
        
        # Mark setup as complete
        mark_setup_complete
        
        print_success "🎉 One-time setup completed successfully!"
        echo ""
        print_status "📋 Next steps:"
        echo "  - Run: ./start-all-optimized.sh (fast startup)"
        echo "  - Or run: ./start-all-improved.sh (with full checks)"
        echo ""
        print_status "💡 The optimized script will start much faster now!"
    else
        print_error "❌ Setup incomplete - some images are missing"
        exit 1
    fi
}

# Run the main function
main "$@"
