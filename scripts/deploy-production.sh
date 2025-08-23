#!/bin/bash

# Production Deployment Script for EC2
# This script is designed to be run on the EC2 instance

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="/home/ec2-user/oms"
LOG_FILE="/home/ec2-user/oms/logs/deployment.log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Redirect all output to log file and console
exec > >(tee -a "$LOG_FILE")
exec 2>&1

echo "=== OMS Production Deployment Started at $(date) ==="

# Change to application directory
cd "$APP_DIR"

# Source environment variables
if [[ -f ".env.production" ]]; then
    echo "Loading production environment..."
    set -a
    source .env.production
    set +a
else
    echo "Warning: .env.production not found, using defaults"
fi

# Set production-specific variables
export NODE_ENV=production
export DOCKER_IMAGE_NAME="${DOCKER_IMAGE_NAME:-oms-app:latest}"

# Function to check system resources
check_system_resources() {
    echo "Checking system resources..."

    # Check memory
    local available_memory=$(free -m | awk 'NR==2{printf "%.1f", $7/1024}')
    echo "Available memory: ${available_memory}GB"

    # Check disk space
    local available_disk=$(df -h / | awk 'NR==2{print $4}')
    echo "Available disk space: $available_disk"

    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        echo "Error: Docker daemon is not running"
        exit 1
    fi

    echo "System resources check passed"
}

# Function to update system packages (if needed)
update_system() {
    echo "Checking for system updates..."

    # Only update if last update was more than 7 days ago
    if [[ $(find /var/lib/apt/history -name "history-*" -mtime -7 | wc -l) -eq 0 ]]; then
        echo "Updating system packages..."
        sudo apt update -y
    else
        echo "System packages are up to date"
    fi
}

# Function to setup monitoring
setup_monitoring() {
    echo "Setting up monitoring..."

    # Create monitoring script
    cat > /home/ec2-user/monitor-oms.sh << 'EOF'
#!/bin/bash

# Simple monitoring script for OMS services
LOG_FILE="/home/ec2-user/oms/logs/monitoring.log"

{
    echo "=== OMS Monitoring Report - $(date) ==="

    # System resources
    echo "System Resources:"
    echo "  Memory: $(free -h | awk 'NR==2{printf "Used: %s/%s (%.2f%%)", $3,$2,$3*100/$2}')"
    echo "  Disk: $(df -h / | awk 'NR==2{printf "Used: %s/%s (%s)", $3,$2,$5}')"
    echo "  Load: $(uptime | awk -F'load average:' '{print $2}')"

    # Docker containers
    echo "Docker Containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -v NAMES

    # Service health
    echo "Service Health:"
    services=("gateway:3000" "auth:3001" "order:3002" "inventory:3003" "product:3004" "cart:3005")
    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"
        if curl -f -s "http://localhost:$port/$name/health" >/dev/null 2>&1; then
            echo "  ✅ $name: Healthy"
        else
            echo "  ❌ $name: Unhealthy"
        fi
    done

    echo "=== End Report ==="
    echo ""
} >> "$LOG_FILE"
EOF

    chmod +x /home/ec2-user/monitor-oms.sh

    # Setup cron job for monitoring (every 5 minutes)
    (crontab -l 2>/dev/null; echo "*/5 * * * * /home/ec2-user/monitor-oms.sh") | crontab -

    echo "Monitoring setup completed"
}

# Function to configure log rotation
setup_log_rotation() {
    echo "Setting up log rotation..."

    sudo tee /etc/logrotate.d/oms-app > /dev/null << EOF
/home/ec2-user/oms/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 ec2-user ec2-user
    postrotate
        docker-compose -f /home/ec2-user/oms/docker-compose.app.slim.yml restart gateway || true
    endscript
}
EOF

    echo "Log rotation configured"
}

# Function to setup automatic backups
setup_backups() {
    echo "Setting up automatic backups..."

    # Create backup script
    cat > /home/ec2-user/backup-oms.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/home/ec2-user/oms-backups"
DATE=$(date +%Y%m%d-%H%M%S)
MAX_BACKUPS=7

mkdir -p "$BACKUP_DIR"

# Backup database
if docker ps | grep -q postgres; then
    echo "Backing up database..."
    docker exec postgres pg_dump -U postgres oms | gzip > "$BACKUP_DIR/oms-db-$DATE.sql.gz"
fi

# Backup application data
if [[ -d "/home/ec2-user/oms/data" ]]; then
    echo "Backing up application data..."
    tar -czf "$BACKUP_DIR/oms-data-$DATE.tar.gz" -C /home/ec2-user/oms data/
fi

# Clean up old backups
cd "$BACKUP_DIR"
ls -t oms-* 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm -f

echo "Backup completed: $DATE"
EOF

    chmod +x /home/ec2-user/backup-oms.sh

    # Setup daily backup cron job
    (crontab -l 2>/dev/null; echo "0 2 * * * /home/ec2-user/backup-oms.sh >> /home/ec2-user/oms/logs/backup.log 2>&1") | crontab -

    echo "Automatic backups configured"
}

# Main deployment function
deploy() {
    echo "Starting production deployment..."

    # Pre-deployment checks
    check_system_resources

    # Update system if needed
    update_system

    # Setup production configurations
    setup_monitoring
    setup_log_rotation
    setup_backups

    # Run the main deployment script
    echo "Executing main deployment..."
    bash "$APP_DIR/deploy.sh"

    # Post-deployment verification
    echo "Performing post-deployment verification..."
    sleep 30

    # Check if all services are running
    local failed_services=0
    services=("gateway:3000" "auth:3001" "order:3002" "inventory:3003" "product:3004" "cart:3005")

    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"
        if ! curl -f -s "http://localhost:$port/$name/health" >/dev/null 2>&1; then
            echo "Warning: $name service health check failed"
            ((failed_services++))
        fi
    done

    if [[ $failed_services -gt 0 ]]; then
        echo "Warning: $failed_services service(s) failed health checks"
        echo "Check logs with: docker-compose logs"
    else
        echo "All services are healthy!"
    fi

    echo "Production deployment completed!"
    echo "Application URL: http://$(curl -s ifconfig.me):3000"
    echo "Logs location: $LOG_FILE"
}

# Execute deployment
deploy

echo "=== OMS Production Deployment Completed at $(date) ==="