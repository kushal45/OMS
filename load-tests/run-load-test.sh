#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
BASE_URL="http://localhost:3000"
TEST_FILE="flash_sale_dynamic_sale.js"
MONITORING_MODE="local"

# Function to display usage
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -f, --file <test_file>     Test file to run (default: flash_sale_dynamic_sale.js)"
    echo "  -u, --url <base_url>       Base URL for API (default: http://localhost:3000)"
    echo "  -m, --mode <mode>          Mode: local or docker (default: local)"
    echo "  -h, --help                 Display this help message"
    echo ""
    echo "Environment variables can be passed after options:"
    echo "  $0 -f flash_sale_dynamic_sale.js -- PEAK_VUS_ADD_CART=10 PEAK_VUS_PLACE_ORDER=5"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--file)
            TEST_FILE="$2"
            shift 2
            ;;
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        -m|--mode)
            MONITORING_MODE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        --)
            shift
            break
            ;;
        *)
            break
            ;;
    esac
done

# Collect remaining arguments as environment variables
ENV_VARS=""
for arg in "$@"; do
    ENV_VARS="$ENV_VARS -e $arg"
done

echo -e "${GREEN}=== k6 Load Testing with Visual Monitoring ===${NC}"
echo ""

# Check if monitoring stack is running
if ! docker ps | grep -q k6_grafana; then
    echo -e "${YELLOW}Starting monitoring stack...${NC}"
    docker-compose -f load-tests/docker-compose.monitoring.yml up -d influxdb grafana
    
    echo -e "${YELLOW}Waiting for services to be ready...${NC}"
    sleep 10
    
    echo -e "${GREEN}Monitoring stack started!${NC}"
    echo -e "${GREEN}Grafana URL: http://localhost:3030${NC}"
    echo -e "${GREEN}Login: admin / admin123${NC}"
    echo ""
fi

# Run the load test
if [ "$MONITORING_MODE" = "docker" ]; then
    echo -e "${YELLOW}Running load test in Docker...${NC}"
    docker-compose -f load-tests/docker-compose.monitoring.yml run --rm \
        -e BASE_URL="$BASE_URL" \
        -e K6_OUT=influxdb=http://influxdb:8086/k6 \
        $ENV_VARS \
        k6 run /scripts/$TEST_FILE
else
    echo -e "${YELLOW}Running load test locally...${NC}"
    echo "Command: k6 run --out influxdb=http://localhost:8086/k6 -e BASE_URL=$BASE_URL $ENV_VARS load-tests/$TEST_FILE"
    
    k6 run --out influxdb=http://localhost:8086/k6 \
        -e BASE_URL="$BASE_URL" \
        $ENV_VARS \
        load-tests/$TEST_FILE
fi

echo ""
echo -e "${GREEN}=== Test Complete ===${NC}"
echo -e "${GREEN}View results at: http://localhost:3030${NC}"
echo -e "${GREEN}Dashboard: k6 Load Testing Results${NC}"
echo ""
echo -e "${YELLOW}To stop monitoring stack:${NC}"
echo "docker-compose -f load-tests/docker-compose.monitoring.yml down"