# 🔍 OMS Container Debugging Guide

## Overview

This guide provides comprehensive strategies for debugging the OMS application running in production-like containers with compiled JavaScript code.

## 🚀 **QUICK DEBUGGING COMMANDS**

### **1. Real-time Log Monitoring**

```bash
# Monitor all services logs in real-time
docker-compose logs -f

# Monitor specific service logs
docker logs -f oms-auth-1
docker logs -f oms-order-1
docker logs -f oms-cart-1
docker logs -f oms-api-gateway-1

# Monitor with timestamps
docker logs -f --timestamps oms-auth-1

# Get last 100 lines and follow
docker logs --tail 100 -f oms-auth-1
```

### **2. Container Inspection**

```bash
# Check container status and health
docker ps -a

# Inspect container configuration
docker inspect oms-auth-1

# Check container resource usage
docker stats

# Get container IP addresses
docker inspect oms-auth-1 | grep IPAddress
```

### **3. Interactive Container Access**

```bash
# Access running container shell
docker exec -it oms-auth-1 /bin/bash
docker exec -it oms-auth-1 /bin/sh  # if bash not available

# Run commands inside container
docker exec oms-auth-1 ls -la /app
docker exec oms-auth-1 cat /app/package.json
docker exec oms-auth-1 node --version
```

---

## 🔧 **DEBUGGING STRATEGIES**

### **1. Enhanced Logging Configuration**

Create a centralized logging utility:

```bash
# Create enhanced logging utility
cat > apps/utils/debug-logger.ts << 'EOF'
export class DebugLogger {
  private static getTimestamp(): string {
    return new Date().toISOString();
  }

  private static getCorrelationId(req?: any): string {
    return req?.headers?.['x-correlation-id'] || `debug-${Date.now()}`;
  }

  static logRequest(req: any, context: string): void {
    const correlationId = this.getCorrelationId(req);
    console.log(`[${this.getTimestamp()}] [${correlationId}] [${context}] REQUEST:`, {
      method: req.method,
      url: req.url,
      headers: this.sanitizeHeaders(req.headers),
      body: req.body,
      params: req.params,
      query: req.query
    });
  }

  static logResponse(res: any, data: any, context: string, correlationId?: string): void {
    console.log(`[${this.getTimestamp()}] [${correlationId}] [${context}] RESPONSE:`, {
      statusCode: res.statusCode,
      data: data
    });
  }

  static logError(error: any, context: string, correlationId?: string): void {
    console.error(`[${this.getTimestamp()}] [${correlationId}] [${context}] ERROR:`, {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
  }

  private static sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    if (sanitized.authorization) {
      sanitized.authorization = 'Bearer ***';
    }
    return sanitized;
  }
}
EOF
```

### **2. Environment Variable Debugging**

```bash
# Check environment variables inside container
docker exec oms-auth-1 env | grep -E "(DATABASE|JWT|REDIS|NODE)"

# Verify specific environment variables
docker exec oms-auth-1 echo $DATABASE_HOST
docker exec oms-auth-1 echo $JWT_SECRET
docker exec oms-auth-1 echo $NODE_ENV
```

### **3. Database Connection Debugging**

```bash
# Test database connectivity from container
docker exec oms-auth-1 nc -zv postgres 5432

# Check database connection from inside container
docker exec -it oms-auth-1 node -e "
const { Client } = require('pg');
const client = new Client({
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD
});
client.connect()
  .then(() => console.log('Database connected successfully'))
  .catch(err => console.error('Database connection failed:', err));
"
```

### **4. Network Debugging**

```bash
# Check network connectivity between containers
docker exec oms-auth-1 ping postgres
docker exec oms-auth-1 ping redis
docker exec oms-api-gateway-1 ping auth

# Check if services are listening on expected ports
docker exec oms-auth-1 netstat -tlnp
docker exec oms-auth-1 ss -tlnp

# Test HTTP endpoints from inside containers
docker exec oms-api-gateway-1 curl -v http://auth:3001/health
docker exec oms-api-gateway-1 curl -v http://order:3002/health
```

---

## 🐛 **COMMON DEBUGGING SCENARIOS**

### **1. Service Not Starting**

```bash
# Check container startup logs
docker logs oms-auth-1

# Check if process is running inside container
docker exec oms-auth-1 ps aux

# Verify application files exist
docker exec oms-auth-1 ls -la /app/dist/apps/auth/src/

# Check for missing dependencies
docker exec oms-auth-1 npm list --depth=0
```

### **2. Database Connection Issues**

```bash
# Verify database is accessible
docker exec oms-postgres-1 pg_isready -U postgres

# Check database logs
docker logs oms-postgres-1

# Test connection with psql
docker exec -it oms-postgres-1 psql -U postgres -d oms -c "SELECT version();"

# Check if migrations ran
docker exec -it oms-postgres-1 psql -U postgres -d oms -c "\dt"
```

### **3. JWT Authentication Issues**

```bash
# Check JWT secret configuration
docker exec oms-auth-1 node -e "console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET')"
docker exec oms-api-gateway-1 node -e "console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET' : 'NOT SET')"

# Test token generation
docker exec oms-auth-1 node -e "
const jwt = require('jsonwebtoken');
const token = jwt.sign({id: 'test', email: 'test@test.com'}, process.env.JWT_SECRET);
console.log('Generated token:', token);
const decoded = jwt.verify(token, process.env.JWT_SECRET);
console.log('Decoded token:', decoded);
"
```

### **4. API Gateway Routing Issues**

```bash
# Check if gateway can reach backend services
docker exec oms-api-gateway-1 curl -v http://auth:3001/health
docker exec oms-api-gateway-1 curl -v http://order:3002/health

# Test gateway endpoints
curl -v http://localhost:3000/auth/health
curl -v http://localhost:3000/order/health

# Check gateway logs for routing
docker logs oms-api-gateway-1 | grep -i proxy
```

---

## 📊 **MONITORING & OBSERVABILITY**

### **1. Health Check Monitoring**

```bash
# Create health check script
cat > scripts/health-check.sh << 'EOF'
#!/bin/bash

services=("api-gateway:3000" "auth:3001" "order:3002" "cart:3003")

for service in "${services[@]}"; do
  name=$(echo $service | cut -d: -f1)
  port=$(echo $service | cut -d: -f2)
  
  if curl -s -f http://localhost:$port/health > /dev/null; then
    echo "✅ $name service is healthy"
  else
    echo "❌ $name service is unhealthy"
  fi
done
EOF

chmod +x scripts/health-check.sh
./scripts/health-check.sh
```

### **2. Performance Monitoring**

```bash
# Monitor container resource usage
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"

# Check container memory usage
docker exec oms-auth-1 cat /proc/meminfo | head -5

# Monitor disk usage
docker exec oms-auth-1 df -h
```

### **3. Log Aggregation**

```bash
# Collect all logs with timestamps
docker-compose logs --timestamps > oms-debug-logs.txt

# Filter logs by service
docker logs oms-auth-1 2>&1 | grep -i error > auth-errors.log
docker logs oms-order-1 2>&1 | grep -i error > order-errors.log

# Search for specific patterns
docker-compose logs | grep -i "database\|connection\|error\|exception"
```

---

## 🔍 **ADVANCED DEBUGGING TECHNIQUES**

### **1. Node.js Debugging in Container**

```bash
# Enable Node.js debugging (requires rebuilding image)
# Add to Dockerfile:
# ENV NODE_OPTIONS="--inspect=0.0.0.0:9229"
# EXPOSE 9229

# Then run with debug port exposed
docker run -p 9229:9229 -p 3001:3001 oms-app-base:latest

# Connect with Chrome DevTools or VS Code
# chrome://inspect or VS Code debugger
```

### **2. Memory Leak Detection**

```bash
# Monitor memory usage over time
while true; do
  echo "$(date): $(docker exec oms-auth-1 cat /proc/meminfo | grep MemAvailable)"
  sleep 30
done

# Generate heap dump (if debugging enabled)
docker exec oms-auth-1 kill -USR2 $(docker exec oms-auth-1 pgrep node)
```

### **3. Database Query Debugging**

```bash
# Enable PostgreSQL query logging
docker exec -it oms-postgres-1 psql -U postgres -c "ALTER SYSTEM SET log_statement = 'all';"
docker exec -it oms-postgres-1 psql -U postgres -c "SELECT pg_reload_conf();"

# Monitor database logs
docker logs -f oms-postgres-1 | grep -i "statement\|error"
```

---

## 🛠 **DEBUGGING TOOLS SETUP**

### **1. Container Debugging Image**

```dockerfile
# Create debugging-enabled image
FROM oms-app-base:latest

# Install debugging tools
RUN apt-get update && apt-get install -y \
    curl \
    netcat \
    telnet \
    htop \
    strace \
    tcpdump \
    && rm -rf /var/lib/apt/lists/*

# Enable Node.js debugging
ENV NODE_OPTIONS="--inspect=0.0.0.0:9229"
EXPOSE 9229
```

### **2. Debug Docker Compose Override**

```yaml
# docker-compose.debug.yml
version: '3.8'
services:
  auth:
    ports:
      - "9229:9229"  # Debug port
    environment:
      - NODE_OPTIONS=--inspect=0.0.0.0:9229
      - DEBUG=*
    volumes:
      - ./debug-logs:/app/logs

  order:
    ports:
      - "9230:9229"  # Debug port
    environment:
      - NODE_OPTIONS=--inspect=0.0.0.0:9229
      - DEBUG=*
```

---

## 📝 **DEBUGGING CHECKLIST**

### **Before Debugging:**
- [ ] Check all containers are running: `docker ps`
- [ ] Verify network connectivity between containers
- [ ] Confirm environment variables are set correctly
- [ ] Check database migrations completed successfully
- [ ] Verify all required ports are exposed

### **During Debugging:**
- [ ] Enable detailed logging in application code
- [ ] Monitor resource usage: `docker stats`
- [ ] Check service health endpoints
- [ ] Verify JWT tokens are valid
- [ ] Test database connectivity
- [ ] Monitor network traffic between services

### **After Debugging:**
- [ ] Document the issue and solution
- [ ] Update monitoring/alerting if needed
- [ ] Consider adding health checks
- [ ] Review and improve error handling
- [ ] Update debugging documentation

---

## 🚨 **EMERGENCY DEBUGGING**

### **Quick Service Restart:**
```bash
# Restart specific service
docker-compose restart auth
docker-compose restart order

# Restart all services
docker-compose restart
```

### **Emergency Log Collection:**
```bash
# Collect all logs quickly
mkdir -p debug-$(date +%Y%m%d-%H%M%S)
cd debug-$(date +%Y%m%d-%H%M%S)
docker-compose logs > all-services.log
docker logs oms-postgres-1 > postgres.log
docker logs oms-redis-1 > redis.log
docker inspect $(docker ps -q) > containers-inspect.json
```

This debugging guide provides comprehensive strategies for troubleshooting your containerized OMS application effectively! 🔧
