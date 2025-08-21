#!/bin/bash

# Test All OMS Service Endpoints
# This script tests all service endpoints to verify they're accessible

set -euo pipefail

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
EC2_HOST="${1:-localhost}"
TIMEOUT=10

echo -e "${BLUE}🔍 Testing OMS Service Endpoints on $EC2_HOST${NC}"
echo "========================================"

# Function to test endpoint
test_endpoint() {
    local service_name="$1"
    local port="$2"
    local path="$3"
    local url="http://$EC2_HOST:$port$path"

    echo -n "Testing $service_name ($port): "

    if curl -f -s --max-time $TIMEOUT "$url" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ HEALTHY${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        return 1
    fi
}

# Function to test database connection
test_database() {
    echo -n "Testing PostgreSQL (5433): "

    if nc -z -w$TIMEOUT "$EC2_HOST" 5433 2>/dev/null; then
        echo -e "${GREEN}✅ ACCESSIBLE${NC}"
        return 0
    else
        echo -e "${RED}❌ NOT ACCESSIBLE${NC}"
        return 1
    fi
}

# Function to test Redis
test_redis() {
    echo -n "Testing Redis (6379): "

    if nc -z -w$TIMEOUT "$EC2_HOST" 6379 2>/dev/null; then
        echo -e "${GREEN}✅ ACCESSIBLE${NC}"
        return 0
    else
        echo -e "${RED}❌ NOT ACCESSIBLE${NC}"
        return 1
    fi
}

# Main testing
echo -e "${BLUE}📊 Health Check Endpoints:${NC}"
echo "----------------------------------------"

# Test all service health endpoints
failed_services=0

test_endpoint "API Gateway" 3000 "/api-gateway/health" || ((failed_services++))
test_endpoint "Auth Service" 3001 "/auth/health" || ((failed_services++))
test_endpoint "Order Service" 3002 "/order/health" || ((failed_services++))
test_endpoint "Inventory Service" 3003 "/inventories/health" || ((failed_services++))
test_endpoint "Product Service" 3004 "/products/health" || ((failed_services++))
test_endpoint "Cart Service" 3005 "/cart/health" || ((failed_services++))

echo ""
echo -e "${BLUE}🗄️ Infrastructure Services:${NC}"
echo "----------------------------------------"

# Test infrastructure services
test_database || ((failed_services++))
test_redis || ((failed_services++))

echo ""
echo -e "${BLUE}🌐 API Endpoint Examples:${NC}"
echo "----------------------------------------"

# Test some actual API endpoints (if services are healthy)
if [[ $failed_services -eq 0 ]]; then
    echo "Testing sample API endpoints..."

    # Test API Gateway routes
    echo -n "API Gateway - Root: "
    if curl -f -s --max-time $TIMEOUT "http://$EC2_HOST:3000/" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ ACCESSIBLE${NC}"
    else
        echo -e "${YELLOW}⚠️ NO ROOT ENDPOINT${NC}"
    fi

    # Test Auth endpoints
    echo -n "Auth - Register endpoint: "
    if curl -f -s --max-time $TIMEOUT "http://$EC2_HOST:3001/auth/register" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ ACCESSIBLE${NC}"
    else
        echo -e "${YELLOW}⚠️ REQUIRES POST DATA${NC}"
    fi

    # Test Product endpoints
    echo -n "Products - List endpoint: "
    if curl -f -s --max-time $TIMEOUT "http://$EC2_HOST:3004/products" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ ACCESSIBLE${NC}"
    else
        echo -e "${YELLOW}⚠️ MAY REQUIRE AUTH${NC}"
    fi

else
    echo -e "${YELLOW}⚠️ Skipping API tests due to failed health checks${NC}"
fi

echo ""
echo "========================================"
echo -e "${BLUE}📋 Summary:${NC}"

if [[ $failed_services -eq 0 ]]; then
    echo -e "${GREEN}✅ All services are healthy and accessible!${NC}"
    echo ""
    echo -e "${BLUE}🔗 Service URLs:${NC}"
    echo "  API Gateway: http://$EC2_HOST:3000"
    echo "  Auth Service: http://$EC2_HOST:3001"
    echo "  Order Service: http://$EC2_HOST:3002"
    echo "  Inventory Service: http://$EC2_HOST:3003"
    echo "  Product Service: http://$EC2_HOST:3004"
    echo "  Cart Service: http://$EC2_HOST:3005"
    echo ""
    echo -e "${BLUE}📖 API Documentation:${NC}"
    echo "  Swagger UI: http://$EC2_HOST:3000/api (if available)"
    echo ""
    echo -e "${BLUE}🔧 Database Connections:${NC}"
    echo "  PostgreSQL: $EC2_HOST:5433"
    echo "  Redis: $EC2_HOST:6379"

elif [[ $failed_services -lt 3 ]]; then
    echo -e "${YELLOW}⚠️ $failed_services service(s) failed - partial deployment${NC}"
    echo "Some services may still be starting up. Wait a few minutes and try again."

else
    echo -e "${RED}❌ $failed_services service(s) failed - deployment issues${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Troubleshooting steps:${NC}"
    echo "1. Check if Docker containers are running:"
    echo "   ssh -i your-key.pem ec2-user@$EC2_HOST 'docker ps'"
    echo ""
    echo "2. Check container logs:"
    echo "   ssh -i your-key.pem ec2-user@$EC2_HOST 'docker-compose logs'"
    echo ""
    echo "3. Check security group settings in AWS console"
    echo ""
    echo "4. Verify EC2 instance has sufficient resources:"
    echo "   ssh -i your-key.pem ec2-user@$EC2_HOST 'free -h && df -h'"
fi

echo ""
echo -e "${BLUE}💡 Usage Examples:${NC}"
echo "  Test localhost: ./scripts/test-all-endpoints.sh"
echo "  Test EC2: ./scripts/test-all-endpoints.sh <EC2_PUBLIC_IP>"
echo "  Test with custom host: ./scripts/test-all-endpoints.sh your-domain.com"

exit $failed_services