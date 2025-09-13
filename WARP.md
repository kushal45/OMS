# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Architecture Overview

This is a **microservices-based Order Management System (OMS)** built with **NestJS** and **TypeScript**. The system uses a **monorepo structure** managed by NestJS CLI with the following architecture:

### Microservices Architecture
- **API Gateway** (Port 3000): Main entry point, handles routing and JWT authentication
- **Auth Service** (Port 3001): User authentication, authorization, and address management  
- **Order Service** (Port 3002): Order lifecycle management and business logic
- **Inventory Service** (Port 3003): Stock management with gRPC endpoints for validation/reservation
- **Product Service** (Port 3004): Product catalog management
- **Cart Service** (Port 3005): Shopping cart operations with gRPC interface

### Communication Patterns
- **REST APIs**: External client communication via API Gateway
- **gRPC**: Inter-service communication (Cart ↔ Inventory, Order ↔ Cart/Inventory)
- **Kafka**: Event-driven architecture for inventory updates and order processing
- **Redis**: Caching, session management, and distributed locking

### Infrastructure Stack
- **Database**: PostgreSQL with TypeORM for ORM
- **Message Queue**: Kafka with Schema Registry for event streaming  
- **Cache**: Redis (standalone mode)
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose with separate infra/app stacks

## Development Commands

### Environment Setup
```bash
# Start infrastructure services (PostgreSQL, Kafka, Redis)
docker-compose -f docker-compose.infra.slim.yml up -d

# Start application services  
docker-compose -f docker-compose.app.slim.yml up -d

# Stop all services
docker-compose -f docker-compose.app.slim.yml -f docker-compose.infra.slim.yml down
```

### Building and Development
```bash
# Build all applications
npm run build:all

# Build specific application
npx nest build <app-name>  # e.g. order, auth, inventory

# Start in development mode (single service)
npm run start:dev

# Start with debugging
npm run start:debug
```

### Testing
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch

# Run end-to-end tests
npm run test:e2e

# Run specific service tests
jest apps/<service-name>  # e.g. jest apps/order
```

### Database Operations
```bash
# Run database migrations
npm run migration:run

# Generate new migration
npm run migration:generate --name=MigrationName

# Create empty migration
npm run migration:create --name=MigrationName

# Revert last migration
npm run migration:revert

# Seed database with test data
npm run seed

# Prepare migrations table
npm run prepare:migrations
```

### Code Quality
```bash
# Lint and fix code
npm run lint

# Format code
npm run format

# Run ESLint on specific pattern
eslint "{src,apps,libs,test}/**/*.ts" --fix
```

### Docker Operations
```bash
# Build application Docker image
docker build -t oms-app .

# Run individual services for debugging
docker run -p 3001:3001 --env-file .env.example oms-app node dist/apps/auth/src/main.js

# Check container health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## Project Structure & Key Concepts

### Monorepo Organization
```
apps/           # Microservices (executable applications)
├── api-gateway # Request routing and authentication
├── auth        # User management and JWT
├── cart        # Shopping cart with gRPC 
├── inventory   # Stock management with Kafka
├── order       # Order processing pipeline
└── product     # Product catalog

libs/           # Shared libraries
├── kafka/      # Kafka producer/consumer abstractions
├── logger/     # Winston-based logging
├── http/       # HTTP filters, pipes, decorators  
├── swagger/    # API documentation utilities
└── constants/  # Shared schemas and types
```

### Communication Flow
1. **External Requests**: Client → API Gateway (JWT validation) → Service
2. **Order Creation**: Order Service → Cart Service (gRPC) → Inventory Service (gRPC)  
3. **Inventory Updates**: Kafka events → Inventory Consumer → Database updates
4. **Inter-service**: Services communicate via gRPC for synchronous operations

### Database Architecture
- **Single PostgreSQL database** shared across services
- **TypeORM entities** in each service's `/entity` folder
- **Migrations** managed centrally in `apps/database/migrations/`
- **Seeding** with test data via `apps/database/seeders/`

### Environment Configuration
- Development: Individual `.env.example` files per service
- Production: Centralized environment variables via Docker Compose
- Database connection configured in `apps/config/dataSource.ts`

## Critical Development Patterns

### Adding New Services
1. Generate with NestJS CLI: `npx nest generate app <service-name>`
2. Add service to `nest-cli.json` projects
3. Create Docker Compose service definition
4. Add gRPC proto files if needed in `src/proto/`
5. Update API Gateway routing if external access needed

### gRPC Service Development
- Proto files located in `apps/<service>/src/proto/`
- Services implement both REST (external) and gRPC (internal) endpoints
- Use `@GrpcMethod()` decorators for gRPC endpoints
- Handle gRPC metadata for tracing and correlation IDs

### Kafka Integration  
- Producer/Consumer abstractions in `libs/kafka/`
- Schema Registry integration for message validation
- Topic management via `KafkaAdminClient`
- Event handlers implement `IMessageHandler` interface

### Database Patterns
- Use TypeORM decorators and repositories
- Generate migrations for schema changes: `npm run migration:generate --name=FeatureName`
- Always run migrations before application startup
- Use database seeders for test data, not production data

### Testing Approach
- Unit tests for services and controllers (`.spec.ts`)
- Integration tests for database operations
- E2E tests for API endpoints (`test/app.e2e-spec.ts`)
- Mock external dependencies (Kafka, gRPC services)

## Deployment & CI/CD

### Local Development
```bash
# Start infrastructure first
docker-compose -f docker-compose.infra.slim.yml up -d

# Wait for services to be ready, then start apps
docker-compose -f docker-compose.app.slim.yml up -d
```

### Production Deployment
- Jenkins pipeline defined in `Jenkinsfile`
- Automated deployment to AWS EC2 via `scripts/deploy.sh`
- Docker images pushed to Docker Hub: `kushal493/oms-app`
- Infrastructure provisioning via CloudFormation

### Key Scripts
- `scripts/deploy.sh`: Production deployment with health checks
- `scripts/start-jenkins-local.sh`: Local Jenkins setup
- `kafka-ready.sh`: Kafka cluster readiness verification

## Service Health Endpoints
- API Gateway: `GET /api-gateway/health`
- Auth Service: `GET /auth/health`  
- Order Service: `GET /order/health`
- Inventory Service: `GET /inventories/health`
- Product Service: `GET /products/health`
- Cart Service: `GET /cart/health`

## Troubleshooting Common Issues

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Test connection manually  
docker exec postgres pg_isready -U postgres

# Run migrations if schema is out of sync
npm run migration:run
```

### Kafka Connectivity
```bash
# Check Kafka health
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Verify topic creation
./kafka-ready.sh
```

### Service Discovery Issues
- Ensure all services are on the same Docker network (`oms-network`)
- Check service names match Docker Compose service definitions
- Verify environment variables for service URLs

### gRPC Communication Failures
- Confirm proto file consistency between services
- Check gRPC server port bindings (5001-5005)
- Validate service registration in NestJS modules

## Development Guidelines

### Code Organization
- Keep business logic in services, not controllers
- Use DTOs for request/response validation with `class-validator`
- Implement proper error handling with custom exceptions
- Follow NestJS dependency injection patterns

### Inter-Service Communication
- Use gRPC for synchronous service-to-service calls
- Use Kafka events for asynchronous operations and data consistency
- Implement circuit breakers for resilience
- Add correlation IDs for distributed tracing

### Performance Considerations  
- Use Redis for caching frequently accessed data
- Implement database connection pooling
- Use pagination for large data sets
- Consider read replicas for high-traffic scenarios

### Security Best Practices
- JWT tokens validated at API Gateway level
- Service-to-service communication within private network
- Environment variables for sensitive configuration
- Input validation on all external endpoints