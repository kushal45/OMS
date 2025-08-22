#!/bin/bash

# EC2 User Data Script for OMS Application Deployment
# This script runs on instance launch to set up the environment

set -e

# Update system
yum update -y

# Install Docker
yum install -y docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# Install Git
yum install -y git

# Install Node.js (for any local operations if needed)
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Create application directory
mkdir -p /home/ubuntu/oms
chown ubuntu:ubuntu /home/ubuntu/oms

# Create Docker network for the application
docker network create oms-network || true

# Create directories for persistent data
mkdir -p /home/ubuntu/oms/data/postgres
mkdir -p /home/ubuntu/oms/data/redis
mkdir -p /home/ubuntu/oms/logs
chown -R ubuntu:ubuntu /home/ubuntu/oms

# Install CloudWatch agent for monitoring
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

# Create swap file for better memory management (important for t2.micro)
dd if=/dev/zero of=/swapfile bs=1024 count=1048576
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile swap swap defaults 0 0' >> /etc/fstab

# Set up log rotation
cat > /etc/logrotate.d/docker-containers << EOF
/home/ubuntu/oms/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 ubuntu ubuntu
}
EOF

# Create deployment script
cat > /home/ubuntu/deploy-oms.sh << 'EOF'
#!/bin/bash
set -e

cd /home/ubuntu/oms

# Pull latest images
docker-compose -f docker-compose.infra.slim.yml pull
docker-compose -f docker-compose.app.slim.yml pull

# Stop existing containers
docker-compose -f docker-compose.app.slim.yml down || true
docker-compose -f docker-compose.infra.slim.yml down || true

# Start infrastructure first
docker-compose -f docker-compose.infra.slim.yml up -d

# Wait for infrastructure to be ready
sleep 30

# Start application services
docker-compose -f docker-compose.app.slim.yml up -d

# Clean up unused images
docker image prune -f

echo "Deployment completed successfully!"
EOF

chmod +x /home/ubuntu/deploy-oms.sh
chown ubuntu:ubuntu /home/ubuntu/deploy-oms.sh

# Create health check script
cat > /home/ubuntu/health-check.sh << 'EOF'
#!/bin/bash

# Health check script for OMS services
SERVICES=("gateway:3000" "auth:3001" "order:3002" "inventory:3003" "product:3004" "cart:3005")

echo "=== OMS Health Check $(date) ==="

for service in "${SERVICES[@]}"; do
    IFS=':' read -r name port <<< "$service"
    if curl -f -s "http://localhost:$port/$name/health" > /dev/null; then
        echo "✅ $name service is healthy"
    else
        echo "❌ $name service is unhealthy"
    fi
done

echo "=== Docker Container Status ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
EOF

chmod +x /home/ubuntu/health-check.sh
chown ubuntu:ubuntu /home/ubuntu/health-check.sh

echo "EC2 setup completed successfully!"