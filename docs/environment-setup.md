# Environment Configuration Guide

This guide covers setting up production environment variables and configuration files for the OMS application deployment.

## 1. Production Environment Variables

### 1.1 Copy and Configure .env.production

On your EC2 instance, copy the production environment template:

```bash
# SSH to your EC2 instance
ssh -i your-key.pem ec2-user@<EC2_IP>

# Navigate to application directory
cd /home/ec2-user/oms

# Copy the production environment template
cp .env.production .env

# Edit with secure values
nano .env
```

### 1.2 Required Environment Variables

Update these critical variables in your `.env` file:

```bash
# Application Environment
NODE_ENV=production

# Docker Configuration
DOCKER_IMAGE_NAME=your-dockerhub-username/oms-app:latest

# Database Security (CRITICAL - Change these!)
POSTGRES_PASSWORD=$(openssl rand -base64 16)
DB_PASSWORD=$(openssl rand -base64 16)
DATABASE_PASSWORD=$(openssl rand -base64 16)

# JWT Security (CRITICAL - Change this!)
JWT_SECRET=$(openssl rand -base64 32)

# Service Configuration
REDIS_CLIENT_TYPE=STANDALONE
REDIS_HOST=redis
REDIS_PORT=6379

# Database Configuration
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_NAME=oms

# Kafka Configuration
KAFKA_BROKERS=kafka:9092

# Service URLs
CART_SERVICE_GRPC_URL=cart:5005
INVENTORY_SERVICE_GRPC_URL=inventory:5002
INVENTORY_SERVICE_URL=inventory:5002
PRODUCT_SERVICE_URL=product:5001

# Kafka Topics
INVENTORY_RESERVE_TOPIC=reserveInventory
INVENTORY_RELEASE_TOPIC=releaseInventory
```

### 1.3 Generate Secure Secrets

Use these commands to generate secure secrets:

```bash
# Generate JWT secret (32+ characters)
echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# Generate database password
echo "POSTGRES_PASSWORD=$(openssl rand -base64 16)" >> .env
echo "DB_PASSWORD=$(openssl rand -base64 16)" >> .env
echo "DATABASE_PASSWORD=$(openssl rand -base64 16)" >> .env

# Generate Redis password (optional)
echo "REDIS_PASSWORD=$(openssl rand -base64 16)" >> .env
```

## 2. Jenkins Environment Variables

### 2.1 Global Environment Variables

In Jenkins, go to **Manage Jenkins** → **Configure System** → **Global Properties** → **Environment variables**:

```bash
# Docker Hub Configuration
DOCKERHUB_USERNAME=your-docker-hub-username

# EC2 Configuration
EC2_HOST=your-ec2-public-ip
EC2_USER=ec2-user

# Application Configuration
NODE_ENV=production
```

### 2.2 Pipeline-specific Variables

Add these to your Jenkinsfile or as pipeline parameters:

```groovy
environment {
    DOCKER_IMAGE_NAME = "${env.DOCKERHUB_USERNAME}/oms-app"
    BUILD_NUMBER = "${env.BUILD_NUMBER}"
    GIT_COMMIT_SHORT = "${env.GIT_COMMIT[0..7]}"
    EC2_HOST = "${env.EC2_HOST}"
    EC2_USER = "${env.EC2_USER ?: 'ec2-user'}"
    NODE_ENV = 'production'
}
```

## 3. Docker Compose Environment Configuration

### 3.1 Update docker-compose.app.slim.yml

Ensure all services use environment variables:

```yaml
services:
  gateway:
    image: ${DOCKER_IMAGE_NAME:-oms-app:latest}
    environment:
      - NODE_ENV=${NODE_ENV:-production}
      - PORT=3000
      - SERVICE_NAME=gateway
      - JWT_SECRET=${JWT_SECRET}
      - REDIS_CLIENT_TYPE=${REDIS_CLIENT_TYPE:-STANDALONE}
      - REDIS_HOST=${REDIS_HOST:-redis}
      - REDIS_PORT=${REDIS_PORT:-6379}
```

### 3.2 Update docker-compose.infra.slim.yml

Configure infrastructure services:

```yaml
services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: oms
      POSTGRES_INITDB_ARGS: "--auth-host=scram-sha-256"
```

## 4. Security Configuration

### 4.1 File Permissions

Set proper permissions for sensitive files:

```bash
# Set restrictive permissions on environment file
chmod 600 .env

# Ensure only ec2-user can read
chown ec2-user:ec2-user .env

# Set permissions for scripts
chmod +x deploy.sh
chmod +x scripts/*.sh
```

### 4.2 Environment File Security

Create a secure environment file template:

```bash
# Create secure template
cat > .env.template << 'EOF'
# Production Environment Template
# Copy this file to .env and update with actual values

# SECURITY WARNING: Update all default values below!

# Application Environment
NODE_ENV=production

# Docker Configuration
DOCKER_IMAGE_NAME=your-dockerhub-username/oms-app:latest

# Database Configuration (UPDATE THESE!)
POSTGRES_PASSWORD=CHANGE_ME_TO_SECURE_PASSWORD
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=CHANGE_ME_TO_SECURE_PASSWORD
DB_NAME=oms

# JWT Configuration (UPDATE THIS!)
JWT_SECRET=CHANGE_ME_TO_SECURE_JWT_SECRET_32_CHARS_MIN

# Redis Configuration
REDIS_CLIENT_TYPE=STANDALONE
REDIS_HOST=redis
REDIS_PORT=6379

# Add other configuration variables here...
EOF
```

## 5. Application-specific Configuration

### 5.1 Database Configuration

Create database initialization script:

```bash
# Create database init script
mkdir -p config/postgres
cat > config/postgres/init.sql << 'EOF'
-- Database initialization script
-- This runs when PostgreSQL container starts for the first time

-- Create additional databases if needed
-- CREATE DATABASE oms_test;

-- Create additional users if needed
-- CREATE USER oms_readonly WITH PASSWORD 'readonly_password';
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO oms_readonly;

-- Set up database-specific configurations
ALTER DATABASE oms SET timezone TO 'UTC';
EOF
```

### 5.2 Redis Configuration

Update Redis configuration for production:

```bash
# Update Redis configuration
cat >> config/redis/redis.conf << 'EOF'

# Production-specific Redis configuration

# Security
# requirepass your_redis_password_here

# Memory optimization for t2.micro
maxmemory 200mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Logging
loglevel notice
EOF
```

### 5.3 Application Logging Configuration

Create logging configuration:

```bash
# Create logging directory
mkdir -p config/logging

# Create log configuration
cat > config/logging/winston.config.js << 'EOF'
const winston = require('winston');

const logConfiguration = {
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        new winston.transports.File({
            filename: '/app/logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        new winston.transports.File({
            filename: '/app/logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        })
    ]
};

module.exports = logConfiguration;
EOF
```

## 6. Monitoring Configuration

### 6.1 Health Check Configuration

Create health check endpoints configuration:

```bash
# Create health check config
cat > config/health-check.json << 'EOF'
{
    "services": [
        {
            "name": "gateway",
            "url": "http://localhost:3000/api-gateway/health",
            "timeout": 5000,
            "retries": 3
        },
        {
            "name": "auth",
            "url": "http://localhost:3001/auth/health",
            "timeout": 5000,
            "retries": 3
        },
        {
            "name": "order",
            "url": "http://localhost:3002/order/health",
            "timeout": 5000,
            "retries": 3
        },
        {
            "name": "inventory",
            "url": "http://localhost:3003/inventories/health",
            "timeout": 5000,
            "retries": 3
        },
        {
            "name": "product",
            "url": "http://localhost:3004/products/health",
            "timeout": 5000,
            "retries": 3
        },
        {
            "name": "cart",
            "url": "http://localhost:3005/cart/health",
            "timeout": 5000,
            "retries": 3
        }
    ],
    "database": {
        "host": "localhost",
        "port": 5433,
        "database": "oms",
        "timeout": 5000
    },
    "redis": {
        "host": "localhost",
        "port": 6379,
        "timeout": 3000
    }
}
EOF
```

## 7. Backup Configuration

### 7.1 Backup Settings

Create backup configuration:

```bash
# Create backup config
cat > config/backup.conf << 'EOF'
# Backup Configuration

# Backup directory
BACKUP_DIR="/home/ec2-user/oms-backups"

# Retention policy
MAX_BACKUPS=7
MAX_BACKUP_AGE_DAYS=30

# Database backup settings
DB_BACKUP_ENABLED=true
DB_BACKUP_COMPRESS=true

# Data backup settings
DATA_BACKUP_ENABLED=true
DATA_BACKUP_COMPRESS=true

# Backup schedule (cron format)
BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM

# Notification settings
BACKUP_NOTIFICATION_EMAIL=""
BACKUP_NOTIFICATION_SLACK_WEBHOOK=""
EOF
```

## 8. Performance Configuration

### 8.1 Resource Limits

Configure resource limits for t2.micro:

```yaml
# Add to docker-compose files
deploy:
  resources:
    limits:
      memory: 256M
      cpus: '0.1'
    reservations:
      memory: 128M
      cpus: '0.05'
```

### 8.2 JVM Configuration (if using Java services)

```bash
# JVM options for memory-constrained environment
JAVA_OPTS="-Xmx128m -Xms64m -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
```

## 9. SSL/TLS Configuration (Optional)

### 9.1 Let's Encrypt Setup

```bash
# Install Certbot
sudo yum install -y certbot

# Generate SSL certificate
sudo certbot certonly --standalone -d your-domain.com

# Create SSL configuration for nginx (if using)
cat > config/nginx/ssl.conf << 'EOF'
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
ssl_prefer_server_ciphers off;
EOF
```

## 10. Validation and Testing

### 10.1 Environment Validation Script

Create a script to validate environment configuration:

```bash
cat > scripts/validate-environment.sh << 'EOF'
#!/bin/bash

# Environment validation script

echo "Validating environment configuration..."

# Check required files
required_files=(".env" "docker-compose.app.slim.yml" "docker-compose.infra.slim.yml")
for file in "${required_files[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo "❌ Missing required file: $file"
        exit 1
    else
        echo "✅ Found: $file"
    fi
done

# Check environment variables
source .env

required_vars=("NODE_ENV" "DOCKER_IMAGE_NAME" "POSTGRES_PASSWORD" "JWT_SECRET")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        echo "❌ Missing environment variable: $var"
        exit 1
    else
        echo "✅ Set: $var"
    fi
done

# Check for default/insecure values
if [[ "$POSTGRES_PASSWORD" == "postgres" ]]; then
    echo "❌ POSTGRES_PASSWORD is using default value"
    exit 1
fi

if [[ "$JWT_SECRET" == "sec1234" ]]; then
    echo "❌ JWT_SECRET is using default value"
    exit 1
fi

echo "✅ Environment validation passed"
EOF

chmod +x scripts/validate-environment.sh
```

## 11. Troubleshooting

### 11.1 Common Environment Issues

1. **Permission Denied Errors**
   ```bash
   # Fix file permissions
   sudo chown -R ec2-user:ec2-user /home/ec2-user/oms
   chmod 600 .env
   ```

2. **Environment Variables Not Loading**
   ```bash
   # Check if .env file is properly formatted
   cat .env | grep -v '^#' | grep '='

   # Validate no spaces around = sign
   grep -n ' = ' .env
   ```

3. **Database Connection Issues**
   ```bash
   # Check database environment variables
   docker exec postgres env | grep POSTGRES

   # Test database connection
   docker exec postgres pg_isready -U postgres
   ```

### 11.2 Environment Debugging

```bash
# Debug environment loading
docker-compose config

# Check service environment variables
docker exec gateway env

# Validate configuration
./scripts/validate-environment.sh
```

This comprehensive environment configuration ensures your OMS application runs securely and efficiently in production.