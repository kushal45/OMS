# Docker Compose Optimization - Shared Base Image

## Overview

The docker-compose.yml file has been optimized to use a shared base image for all Node.js services (gateway, auth, order, inventory, product, cart). This optimization significantly reduces build time and disk usage by:

1. Building the base image only once
2. Running `npm install` only once
3. Reusing the same image layers for all services

## How It Works

### 1. Base Image Service
A new service `app-base` has been added that builds the shared image:

```yaml
app-base:
  image: oms-app-base:latest
  build:
    context: .
    dockerfile: Dockerfile
  command: echo "Base image built successfully"
  profiles:
    - build-only
```

This service:
- Builds the image with tag `oms-app-base:latest`
- Uses the `build-only` profile so it doesn't run by default
- Only exists to build the shared image

### 2. Service Configuration
All Node.js services now use the shared image:

```yaml
gateway:
  image: oms-app-base:latest
  depends_on:
    - app-base
  # ... rest of configuration
```

Each service:
- Uses `image: oms-app-base:latest` instead of `build:`
- Depends on `app-base` to ensure the image is built first
- Keeps all other configurations (ports, environment, volumes, etc.)

## Usage

### Building the Base Image

Use the provided script to build the base image:

```bash
./docker-compose-build.sh
```

Or manually:

```bash
docker-compose build app-base
```

### Starting Services

After building the base image, start services normally:

```bash
# Start all services
docker-compose up -d

# Start specific services
docker-compose up -d gateway auth order

# View logs
docker-compose logs -f gateway
```

### Rebuilding After Code Changes

Since volumes are mounted (`./:/app`), code changes are reflected immediately without rebuilding. However, if you need to rebuild (e.g., after changing dependencies):

```bash
# Rebuild the base image
docker-compose build app-base

# Restart services to use the new image
docker-compose restart gateway auth order inventory product cart
```

## Benefits

1. **Faster Builds**: `npm install` runs only once instead of 6 times
2. **Less Disk Usage**: Single image layer shared across all services
3. **Consistent Dependencies**: All services use exactly the same node_modules
4. **Easier Updates**: Update dependencies in one place

## Technical Details

- The base image includes all dependencies from package.json
- Each service runs its specific command (e.g., `npm run start:debug --project auth`)
- Development volumes (`./:/app`) allow hot reloading
- Debug ports are still exposed for each service

## Rollback

To rollback to individual builds per service, simply replace:

```yaml
image: oms-app-base:latest
depends_on:
  - app-base
```

With:

```yaml
build:
  context: .
```

For each service in docker-compose.yml.

## Troubleshooting

### Redis Sentinel Hostname Resolution

If you encounter "Failed to resolve hostname 'redis-master'" errors in Redis sentinel containers, the fix has been applied:

1. **Dynamic IP Resolution**: Created `sentinel-entrypoint.sh` script that:
   - Waits for Redis master to be available
   - Resolves the Redis master hostname to IP address at runtime
   - Creates a temporary sentinel configuration with the resolved IP
   - Starts Redis Sentinel with the dynamically generated config

2. **Health Check Dependencies**: Sentinels wait for Redis master and replica to be healthy before starting

3. **Extended Start Period**: 30-second grace period for health checks to allow for DNS resolution

This approach avoids the hostname resolution issue that occurs when Redis Sentinel tries to parse the configuration file before Docker's DNS is ready.

### Files Added:
- `config/redis/sentinel-entrypoint.sh` - Dynamic sentinel startup script