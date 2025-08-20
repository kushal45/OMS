#!/bin/bash

# Exit on any error
set -e

# Parse command line arguments
FORCE_REBUILD=false
SKIP_REBUILD_CHECK=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --force-rebuild)
            FORCE_REBUILD=true
            shift
            ;;
        --skip-rebuild-check)
            SKIP_REBUILD_CHECK=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --force-rebuild       Force rebuild of application image regardless of changes"
            echo "  --skip-rebuild-check  Skip automatic rebuild check (use existing image)"
            echo "  --help, -h           Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0                    # Normal startup with automatic rebuild check"
            echo "  $0 --force-rebuild   # Force rebuild application image"
            echo "  $0 --skip-rebuild-check # Skip rebuild check for faster startup"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

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

# Function to generate a hash of source files for change detection
generate_source_hash() {
    local hash_file=".build-hash"
    local temp_hash_file="/tmp/oms-current-hash"

    # Generate hash of key source files and directories
    {
        find apps libs -type f \( -name "*.ts" -o -name "*.js" -o -name "*.json" -o -name "*.proto" \) -exec sha256sum {} \; 2>/dev/null || \
        find apps libs -type f \( -name "*.ts" -o -name "*.js" -o -name "*.json" -o -name "*.proto" \) -exec shasum -a 256 {} \; 2>/dev/null || \
        echo "hash-unavailable"

        # Include key configuration files
        for file in package.json package-lock.json tsconfig.json nest-cli.json Dockerfile; do
            if [ -f "$file" ]; then
                sha256sum "$file" 2>/dev/null || shasum -a 256 "$file" 2>/dev/null || echo "hash-unavailable $file"
            fi
        done
    } | sort | sha256sum 2>/dev/null | cut -d' ' -f1 > "$temp_hash_file" || \
    {
        # Fallback for systems without sha256sum
        echo "fallback-hash-$(date +%s)" > "$temp_hash_file"
    }

    echo "$temp_hash_file"
}

# Function to check if source hash has changed
check_source_hash_changed() {
    local hash_file=".build-hash"
    local current_hash_file=$(generate_source_hash)
    local current_hash=$(cat "$current_hash_file" 2>/dev/null || echo "")
    local stored_hash=$(cat "$hash_file" 2>/dev/null || echo "")

    rm -f "$current_hash_file"

    if [ "$current_hash" != "$stored_hash" ] || [ -z "$stored_hash" ]; then
        return 0  # Hash changed or no stored hash
    else
        return 1  # Hash unchanged
    fi
}

# Function to store current source hash
store_source_hash() {
    local hash_file=".build-hash"
    local current_hash_file=$(generate_source_hash)

    if [ -f "$current_hash_file" ]; then
        cp "$current_hash_file" "$hash_file"
        rm -f "$current_hash_file"
        print_status "Source hash stored for future change detection"
    fi
}

# Function to check if application code has changed and rebuild if necessary
check_and_rebuild_if_needed() {
    local image_name="oms-app-base:latest"
    local rebuild_needed=false
    local rebuild_reason=""

    # Check command line flags
    if [ "$SKIP_REBUILD_CHECK" = true ]; then
        print_status "⏭️  Skipping rebuild check (--skip-rebuild-check flag)"
        return 0
    fi

    if [ "$FORCE_REBUILD" = true ]; then
        print_status "🔨 Force rebuild requested (--force-rebuild flag)"
        rebuild_needed=true
        rebuild_reason="Force rebuild requested via command line"
    else
        print_status "🔍 Checking if application code has changed..."

        # First check using hash-based approach (most reliable)
        if check_source_hash_changed; then
            rebuild_needed=true
            rebuild_reason="Source code hash has changed (most reliable detection method)"
        fi
    fi

    # Check if image exists (unless force rebuild is requested)
    if [ "$FORCE_REBUILD" != true ]; then
        if ! docker image inspect "$image_name" >/dev/null 2>&1; then
            rebuild_needed=true
            rebuild_reason="Image does not exist"
        fi
    fi

    # Only do detailed checks if not forcing rebuild and image exists
    if [ "$FORCE_REBUILD" != true ] && [ "$rebuild_needed" != true ]; then
        # Get image creation time
        local image_created=$(docker image inspect "$image_name" --format='{{.Created}}' 2>/dev/null)
        local image_timestamp=$(date -d "$image_created" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${image_created%.*}" +%s 2>/dev/null || echo "0")

        print_status "Image was created: $image_created"

        # Check Git status for uncommitted changes
        if command -v git >/dev/null 2>&1 && [ -d ".git" ]; then
            local git_status=$(git status --porcelain 2>/dev/null || echo "")
            if [ -n "$git_status" ]; then
                # Check if any of the changed files are source files
                local changed_source_files=$(echo "$git_status" | grep -E '\.(ts|js|json|proto)$|Dockerfile|package.*\.json' || echo "")
                if [ -n "$changed_source_files" ]; then
                    rebuild_needed=true
                    rebuild_reason="Uncommitted changes detected in source files"
                    print_status "Detected uncommitted changes in source files:"
                    echo "$changed_source_files" | head -5
                fi
            fi
        fi

        # Check if any source files are newer than the image (if not already flagged for rebuild)
        if [ "$rebuild_needed" != true ]; then
            local source_dirs=("apps" "libs" "package.json" "package-lock.json" "tsconfig.json" "nest-cli.json" "Dockerfile")
            local newest_file=""
            local newest_timestamp=0

        for dir in "${source_dirs[@]}"; do
            if [ -e "$dir" ]; then
                # Find the newest file in each directory/file
                if [ -d "$dir" ]; then
                    local newest_in_dir=$(find "$dir" -type f \( -name "*.ts" -o -name "*.js" -o -name "*.json" -o -name "*.proto" \) -newer <(date -d "@$image_timestamp" 2>/dev/null || date -r "$image_timestamp" 2>/dev/null || echo) 2>/dev/null | head -1)
                    if [ -n "$newest_in_dir" ]; then
                        local file_timestamp=$(stat -c %Y "$newest_in_dir" 2>/dev/null || stat -f %m "$newest_in_dir" 2>/dev/null || echo "0")
                        if [ "$file_timestamp" -gt "$newest_timestamp" ]; then
                            newest_timestamp=$file_timestamp
                            newest_file="$newest_in_dir"
                        fi
                    fi
                else
                    # Single file
                    local file_timestamp=$(stat -c %Y "$dir" 2>/dev/null || stat -f %m "$dir" 2>/dev/null || echo "0")
                    if [ "$file_timestamp" -gt "$image_timestamp" ] && [ "$file_timestamp" -gt "$newest_timestamp" ]; then
                        newest_timestamp=$file_timestamp
                        newest_file="$dir"
                    fi
                fi
            fi
        done

            if [ "$newest_timestamp" -gt "$image_timestamp" ]; then
                rebuild_needed=true
                rebuild_reason="Source code is newer than image. Newest file: $newest_file"
            fi
        fi

        # Check if dependencies have changed
        if [ -f "package-lock.json" ]; then
            local package_lock_timestamp=$(stat -c %Y "package-lock.json" 2>/dev/null || stat -f %m "package-lock.json" 2>/dev/null || echo "0")
            if [ "$package_lock_timestamp" -gt "$image_timestamp" ]; then
                rebuild_needed=true
                rebuild_reason="Dependencies have changed (package-lock.json is newer)"
            fi
        fi

        # Check if Dockerfile has changed
        if [ -f "Dockerfile" ]; then
            local dockerfile_timestamp=$(stat -c %Y "Dockerfile" 2>/dev/null || stat -f %m "Dockerfile" 2>/dev/null || echo "0")
            if [ "$dockerfile_timestamp" -gt "$image_timestamp" ]; then
                rebuild_needed=true
                rebuild_reason="Dockerfile has been modified"
            fi
        fi
    fi

    if [ "$rebuild_needed" = true ]; then
        print_warning "Rebuild needed: $rebuild_reason"
        print_status "🔨 Rebuilding application image..."

        # Remove old image to ensure clean build
        docker rmi "$image_name" 2>/dev/null || true

        # Build new image with no cache to ensure fresh build
        if docker build --no-cache -t "$image_name" .; then
            print_success "Application image rebuilt successfully"
            # Store the new source hash for future comparisons
            store_source_hash
        else
            print_error "Failed to rebuild application image"
            print_status "💡 Make sure you have all dependencies installed:"
            print_status "   npm install"
            print_status "   npm run build"
            exit 1
        fi
    else
        print_success "Application image is up to date"
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

# Function to wait for service health with better error handling
wait_for_service() {
    local service_name=$1
    local max_attempts=60
    local attempt=1
    
    print_status "Waiting for $service_name to be healthy..."
    
    while [ $attempt -le $max_attempts ]; do
        if docker-compose -f docker-compose.infra.slim.yml ps "$service_name" | grep -q "healthy"; then
            print_success "$service_name is healthy"
            return 0
        fi
        
        # Check if container is running but not healthy
        if docker-compose -f docker-compose.infra.slim.yml ps "$service_name" | grep -q "Up"; then
            print_status "Attempt $attempt/$max_attempts - $service_name is running but not healthy yet..."
        else
            print_status "Attempt $attempt/$max_attempts - $service_name not running yet..."
        fi
        
        sleep 5
        ((attempt++))
    done
    
    print_error "$service_name failed to become healthy after $max_attempts attempts"
    return 1
}

# Function to wait for Kafka to be fully ready
wait_for_kafka() {
    print_status "⏳ Waiting for Kafka to be fully ready..."
    
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        # First check if the container is running
        if ! docker ps | grep -q "kafka"; then
            print_status "Attempt $attempt/$max_attempts - Kafka container not running yet..."
            sleep 5
            ((attempt++))
            continue
        fi
        
        # Try to connect to Kafka and list topics
        if docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list >/dev/null 2>&1; then
            print_success "Kafka is fully ready and accepting connections"
            return 0
        fi
        
        # Alternative check: try to create a test topic
        if docker exec kafka kafka-topics --bootstrap-server localhost:9092 --create --topic test-health-check --partitions 1 --replication-factor 1 --if-not-exists >/dev/null 2>&1; then
            # Clean up test topic
            docker exec kafka kafka-topics --bootstrap-server localhost:9092 --delete --topic test-health-check >/dev/null 2>&1 || true
            print_success "Kafka is fully ready and accepting connections"
            return 0
        fi
        
        print_status "Attempt $attempt/$max_attempts - Kafka not ready yet..."
        sleep 10
        ((attempt++))
    done
    
    print_warning "Kafka health check timed out, but continuing..."
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
    
    # Wait for Kafka to be fully ready
    wait_for_kafka
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
        sleep 30
        
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
    sleep 20
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

# Function to check for failed services
check_failed_services() {
    print_status "🔍 Checking for failed services..."
    
    local failed_services=()
    
    # Check infrastructure services
    if docker-compose -f docker-compose.infra.slim.yml ps | grep -q "Exit"; then
        failed_services+=("infrastructure")
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


start_infra_app(){
    print_status "Starting Infrastructure services first..."
    if docker-compose -f docker-compose.infra.slim.yml up -d; then
        print_success "Infrastructure services started"
    else
        print_error "Failed to start infrastructure services"
        exit 1
    fi

    # Wait for Kafka to be ready before starting applications
    print_status "Waiting for Kafka to be ready..."
    max_attempts=30
    attempt=1

    while [ $attempt -le $max_attempts ]; do
        if docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list > /dev/null 2>&1; then
            print_success "Kafka is ready (attempt $attempt/$max_attempts)"
            break
        else
            print_status "Waiting for Kafka... (attempt $attempt/$max_attempts)"
            sleep 3
            ((attempt++))
        fi
    done

    if [ $attempt -gt $max_attempts ]; then
        print_error "Kafka failed to become ready after $max_attempts attempts"
        print_error "Check Kafka logs with: docker logs kafka"
        exit 1
    fi

    # Now start application services
    print_status "Starting Application services..."
    if docker-compose -f docker-compose.app.slim.yml up -d; then
        print_success "Application services started"
    else
        print_error "Failed to start application services"
        exit 1
    fi
}




# Main execution
main() {
    print_status "🚀 Starting OMS Application Stack (Optimized Mode)"
    echo "====================================================="
    
    # Check Docker
    check_docker
    
    # Check images
    check_images

    # Check if application code has changed and rebuild if necessary
    if [ "$SKIP_REBUILD_CHECK" != true ]; then
        check_and_rebuild_if_needed
    else
        print_status "⏭️  Skipping rebuild check as requested"
    fi

    # Create network
    create_network

    # Cleanup existing
    cleanup_existing
    

    
    
    # Start Infrastructure and  applications
    start_infra_app
    
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
    echo "  - View app logs: docker-compose -f docker-compose.app.slim.yml logs -f"
    echo "  - Stop all: docker-compose -f docker-compose.infra.slim.yml down && docker-compose -f docker-compose.app.slim.yml down"
    echo "  - Restart: ./start-all-optimized.sh"
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
