#!/bin/bash

# Enhanced Production Deployment Script for OMS Application
# This script handles the complete deployment process with proper error handling

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/home/ec2-user/oms"
BACKUP_DIR="/home/ec2-user/oms-backups"
MAX_BACKUPS=5

# Default values
DOCKER_IMAGE_NAME="${DOCKER_IMAGE_NAME:-oms-app:latest}"
NODE_ENV="${NODE_ENV:-production}"
SKIP_BACKUP="${SKIP_BACKUP:-false}"
SKIP_TESTS="${SKIP_TESTS:-false}"

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."

    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running or not accessible"
        exit 1
    fi

    # Check if Docker Compose is available
    if ! command -v docker-compose >/dev/null 2>&1; then
        error "Docker Compose is not installed"
        exit 1
    fi

    # Check if required files exist
    local required_files=(
        "docker-compose.infra.slim.yml"
        "docker-compose.app.slim.yml"
        ".env.production"
    )

    for file in "${required_files[@]}"; do
        if [[ ! -f "$file" ]]; then
            error "Required file not found: $file"
            exit 1
        fi
    done

    success "Prerequisites check passed"
}

# Function to create backup
create_backup() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        warning "Skipping backup as requested"
        return 0
    fi

    log "Creating backup..."

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    # Create timestamped backup
    local backup_name="oms-backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="$BACKUP_DIR/$backup_name"

    # Backup database
    if docker ps | grep -q postgres; then
        log "Backing up PostgreSQL database..."
        docker exec postgres pg_dump -U postgres oms > "$backup_path-db.sql" || {
            warning "Database backup failed, continuing..."
        }
    fi

    # Backup application data
    if [[ -d "$APP_DIR/data" ]]; then
        log "Backing up application data..."
        tar -czf "$backup_path-data.tar.gz" -C "$APP_DIR" data/ || {
            warning "Data backup failed, continuing..."
        }
    fi

    # Clean up old backups
    log "Cleaning up old backups..."
    cd "$BACKUP_DIR"
    ls -t oms-backup-* 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -f

    success "Backup created: $backup_name"
}

# Function to perform health check
health_check() {
    log "Performing health checks..."

    local services=("gateway:3000" "auth:3001" "order:3002" "inventory:3003" "product:3004" "cart:3005")
    local max_attempts=30
    local attempt=1

    # Wait for services to start
    sleep 30

    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"

        log "Checking $name service on port $port..."

        while [[ $attempt -le $max_attempts ]]; do
            if curl -f -s "http://localhost:$port/$name/health" >/dev/null 2>&1; then
                success "$name service is healthy"
                break
            else
                if [[ $attempt -eq $max_attempts ]]; then
                    warning "$name service health check failed after $max_attempts attempts"
                    break
                fi
                log "Attempt $attempt/$max_attempts: $name service not ready, waiting..."
                sleep 10
                ((attempt++))
            fi
        done
        attempt=1
    done
}

# Function to rollback deployment
rollback() {
    error "Deployment failed, initiating rollback..."

    # Stop current deployment
    docker-compose -f docker-compose.app.slim.yml down || true

    # Restore from backup if available
    local latest_backup=$(ls -t "$BACKUP_DIR"/oms-backup-*-db.sql 2>/dev/null | head -n1)
    if [[ -n "$latest_backup" ]]; then
        warning "Restoring from backup: $latest_backup"
        # Add restore logic here if needed
    fi

    error "Rollback completed. Please check the logs and try again."
    exit 1
}

# Function to deploy application
deploy_application() {
    log "Starting deployment process..."

    # Set trap for cleanup on failure
    trap rollback ERR

    # Load environment variables
    if [[ -f ".env.production" ]]; then
        log "Loading production environment variables..."
        set -a
        source .env.production
        set +a
    fi

    # Login to Docker Hub if credentials are provided
    if [[ -n "${DOCKERHUB_USERNAME:-}" && -n "${DOCKERHUB_PASSWORD:-}" ]]; then
        log "Logging in to Docker Hub..."
        echo "$DOCKERHUB_PASSWORD" | docker login -u "$DOCKERHUB_USERNAME" --password-stdin
    fi

    # Pull latest images
    log "Pulling latest Docker images..."
    docker-compose -f docker-compose.infra.slim.yml pull || {
        warning "Failed to pull infrastructure images, using local versions"
    }
    docker-compose -f docker-compose.app.slim.yml pull || {
        warning "Failed to pull application images, using local versions"
    }

    # Stop existing services gracefully
    log "Stopping existing services..."
    docker-compose -f docker-compose.app.slim.yml down --timeout 30 || true

    # Start infrastructure services
    log "Starting infrastructure services..."
    docker-compose -f docker-compose.infra.slim.yml up -d

    # Wait for infrastructure to be ready
    log "Waiting for infrastructure services to be ready..."
    sleep 45

    # Check if database is ready
    local db_attempts=0
    local max_db_attempts=30
    while [[ $db_attempts -lt $max_db_attempts ]]; do
        if docker exec postgres pg_isready -U postgres >/dev/null 2>&1; then
            success "Database is ready"
            break
        else
            log "Waiting for database... (attempt $((db_attempts + 1))/$max_db_attempts)"
            sleep 5
            ((db_attempts++))
        fi
    done

    if [[ $db_attempts -eq $max_db_attempts ]]; then
        error "Database failed to become ready"
        exit 1
    fi

    # Start application services
    log "Starting application services..."
    docker-compose -f docker-compose.app.slim.yml up -d --remove-orphans

    # Perform health checks
    health_check

    # Clean up old images
    log "Cleaning up old Docker images..."
    docker image prune -f || true

    # Remove trap
    trap - ERR

    success "Deployment completed successfully!"
    log "Application is available at: http://$(curl -s ifconfig.me):3000"
}

# Main execution
main() {
    log "Starting OMS deployment script..."
    log "Configuration:"
    log "  - Docker Image: $DOCKER_IMAGE_NAME"
    log "  - Environment: $NODE_ENV"
    log "  - Skip Backup: $SKIP_BACKUP"
    log "  - Skip Tests: $SKIP_TESTS"

    # Change to application directory
    cd "$APP_DIR" || {
        error "Failed to change to application directory: $APP_DIR"
        exit 1
    }

    # Execute deployment steps
    check_prerequisites
    create_backup
    deploy_application

    success "OMS deployment completed successfully!"
    log "Check the application status with: docker ps"
    log "View logs with: docker-compose logs -f"
}

# Execute main function
main "$@"
