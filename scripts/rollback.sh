#!/bin/bash

# OMS Application Rollback Script
# This script handles rollback to previous version or backup

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_DIR="/home/ec2-user/oms"
BACKUP_DIR="/home/ec2-user/oms-backups"
LOG_FILE="/home/ec2-user/oms/logs/rollback.log"

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -t, --to-tag TAG        Rollback to specific Docker image tag"
    echo "  -b, --backup BACKUP     Restore from specific backup"
    echo "  -l, --list-backups      List available backups"
    echo "  -f, --force             Force rollback without confirmation"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --to-tag v1.2.3      # Rollback to specific image tag"
    echo "  $0 --backup 20231201     # Restore from backup"
    echo "  $0 --list-backups        # Show available backups"
}

# Function to list available backups
list_backups() {
    log "Available backups:"

    if [[ ! -d "$BACKUP_DIR" ]]; then
        warning "No backup directory found at $BACKUP_DIR"
        return 1
    fi

    echo ""
    echo "Database Backups:"
    ls -la "$BACKUP_DIR"/oms-db-*.sql.gz 2>/dev/null | awk '{print "  " $9 " (" $5 " bytes, " $6 " " $7 " " $8 ")"}' || echo "  No database backups found"

    echo ""
    echo "Data Backups:"
    ls -la "$BACKUP_DIR"/oms-data-*.tar.gz 2>/dev/null | awk '{print "  " $9 " (" $5 " bytes, " $6 " " $7 " " $8 ")"}' || echo "  No data backups found"

    echo ""
}

# Function to confirm action
confirm_action() {
    local message="$1"
    local force="${2:-false}"

    if [[ "$force" == "true" ]]; then
        return 0
    fi

    echo -e "${YELLOW}$message${NC}"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Operation cancelled by user"
        exit 0
    fi
}

# Function to stop current services
stop_services() {
    log "Stopping current services..."

    cd "$APP_DIR"

    # Stop application services
    docker-compose -f docker-compose.app.slim.yml down --timeout 30 || {
        warning "Failed to stop some application services gracefully"
        docker-compose -f docker-compose.app.slim.yml kill || true
    }

    success "Services stopped"
}

# Function to rollback to specific image tag
rollback_to_tag() {
    local target_tag="$1"
    local force="${2:-false}"

    log "Rolling back to image tag: $target_tag"

    # Confirm action
    confirm_action "This will rollback the application to tag '$target_tag'" "$force"

    # Stop current services
    stop_services

    # Update environment variable
    export DOCKER_IMAGE_NAME="${DOCKER_IMAGE_NAME%:*}:$target_tag"

    log "Pulling image: $DOCKER_IMAGE_NAME"

    # Pull the target image
    if ! docker pull "$DOCKER_IMAGE_NAME"; then
        error "Failed to pull image: $DOCKER_IMAGE_NAME"
        error "Available tags can be checked on Docker Hub"
        exit 1
    fi

    # Start services with the target image
    log "Starting services with rollback image..."

    cd "$APP_DIR"

    # Start infrastructure first
    docker-compose -f docker-compose.infra.slim.yml up -d

    # Wait for infrastructure
    sleep 30

    # Start application with new image
    DOCKER_IMAGE_NAME="$DOCKER_IMAGE_NAME" docker-compose -f docker-compose.app.slim.yml up -d

    # Health check
    perform_health_check

    success "Rollback to tag '$target_tag' completed successfully"
}

# Function to restore from backup
restore_from_backup() {
    local backup_date="$1"
    local force="${2:-false}"

    log "Restoring from backup: $backup_date"

    # Find backup files
    local db_backup="$BACKUP_DIR/oms-db-$backup_date.sql.gz"
    local data_backup="$BACKUP_DIR/oms-data-$backup_date.tar.gz"

    if [[ ! -f "$db_backup" && ! -f "$data_backup" ]]; then
        error "No backup found for date: $backup_date"
        error "Use --list-backups to see available backups"
        exit 1
    fi

    # Confirm action
    confirm_action "This will restore data from backup '$backup_date'. Current data will be lost!" "$force"

    # Stop current services
    stop_services

    # Restore database if backup exists
    if [[ -f "$db_backup" ]]; then
        log "Restoring database from: $db_backup"

        # Start only postgres for restore
        cd "$APP_DIR"
        docker-compose -f docker-compose.infra.slim.yml up -d postgres

        # Wait for postgres
        sleep 20

        # Drop and recreate database
        docker exec postgres psql -U postgres -c "DROP DATABASE IF EXISTS oms;"
        docker exec postgres psql -U postgres -c "CREATE DATABASE oms;"

        # Restore database
        gunzip -c "$db_backup" | docker exec -i postgres psql -U postgres -d oms

        success "Database restored from backup"
    fi

    # Restore data if backup exists
    if [[ -f "$data_backup" ]]; then
        log "Restoring application data from: $data_backup"

        # Remove current data directory
        rm -rf "$APP_DIR/data"

        # Extract backup
        tar -xzf "$data_backup" -C "$APP_DIR"

        success "Application data restored from backup"
    fi

    # Start all services
    log "Starting all services..."
    docker-compose -f docker-compose.infra.slim.yml up -d
    sleep 30
    docker-compose -f docker-compose.app.slim.yml up -d

    # Health check
    perform_health_check

    success "Restore from backup '$backup_date' completed successfully"
}

# Function to perform health check
perform_health_check() {
    log "Performing health check..."

    local services=("gateway:3000" "auth:3001" "order:3002" "inventory:3003" "product:3004" "cart:3005")
    local max_attempts=30
    local failed_services=0

    # Wait for services to start
    sleep 60

    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"

        local attempt=1
        local service_healthy=false

        while [[ $attempt -le $max_attempts ]]; do
            if curl -f -s "http://localhost:$port/$name/health" >/dev/null 2>&1; then
                success "$name service is healthy"
                service_healthy=true
                break
            else
                if [[ $attempt -eq $max_attempts ]]; then
                    error "$name service health check failed"
                    ((failed_services++))
                    break
                fi
                sleep 5
                ((attempt++))
            fi
        done
    done

    if [[ $failed_services -gt 0 ]]; then
        warning "$failed_services service(s) failed health checks"
        warning "Check logs with: docker-compose logs"
        return 1
    else
        success "All services are healthy"
        return 0
    fi
}

# Main function
main() {
    local target_tag=""
    local backup_date=""
    local force=false
    local list_backups_only=false

    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -t|--to-tag)
                target_tag="$2"
                shift 2
                ;;
            -b|--backup)
                backup_date="$2"
                shift 2
                ;;
            -l|--list-backups)
                list_backups_only=true
                shift
                ;;
            -f|--force)
                force=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"

    log "Starting OMS rollback process..."

    # Handle list backups
    if [[ "$list_backups_only" == "true" ]]; then
        list_backups
        exit 0
    fi

    # Validate arguments
    if [[ -n "$target_tag" && -n "$backup_date" ]]; then
        error "Cannot specify both --to-tag and --backup options"
        show_usage
        exit 1
    fi

    if [[ -z "$target_tag" && -z "$backup_date" ]]; then
        error "Must specify either --to-tag or --backup option"
        show_usage
        exit 1
    fi

    # Change to application directory
    cd "$APP_DIR" || {
        error "Failed to change to application directory: $APP_DIR"
        exit 1
    }

    # Execute rollback
    if [[ -n "$target_tag" ]]; then
        rollback_to_tag "$target_tag" "$force"
    elif [[ -n "$backup_date" ]]; then
        restore_from_backup "$backup_date" "$force"
    fi

    log "Rollback process completed"
}

# Execute main function
main "$@"