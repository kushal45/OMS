#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
BASE_URL="${BASE_URL:-http://localhost:3000/api}"
NUM_USERS="${NUM_USERS:-10}"
USER_PREFIX="${USER_PREFIX:-loadtest}"
USER_DOMAIN="${USER_DOMAIN:-example.com}"
USER_PASSWORD="${USER_PASSWORD:-password123}"

echo -e "${GREEN}=== Test User Setup Script ===${NC}"
echo ""
echo "This script will create test users for load testing"
echo ""
echo "Configuration:"
echo "  BASE_URL: $BASE_URL"
echo "  NUM_USERS: $NUM_USERS"
echo "  USER_PREFIX: $USER_PREFIX"
echo "  USER_DOMAIN: $USER_DOMAIN"
echo ""

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed${NC}"
    echo "Please install k6 first: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

# Run the setup script
echo -e "${YELLOW}Creating $NUM_USERS test users...${NC}"
echo ""

k6 run \
  -e BASE_URL="$BASE_URL" \
  -e NUM_USERS="$NUM_USERS" \
  -e USER_PREFIX="$USER_PREFIX" \
  -e USER_DOMAIN="$USER_DOMAIN" \
  -e USER_PASSWORD="$USER_PASSWORD" \
  load-tests/setup-users.js

# Check if users.json was created
if [ -f "users.json" ]; then
    echo ""
    echo -e "${GREEN}✓ users.json created successfully!${NC}"
    echo ""
    echo "Created users:"
    cat users.json | jq -r '.[] | "  - \(.email)"' 2>/dev/null || cat users.json
    
    # Move to load-tests directory
    mv users.json load-tests/users.json
    echo ""
    echo -e "${GREEN}✓ Moved users.json to load-tests directory${NC}"
else
    echo ""
    echo -e "${YELLOW}Note: users.json was not created automatically.${NC}"
    echo "Please check the console output above and manually create load-tests/users.json"
fi

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "You can now run the load test with pre-created users:"
echo ""
echo "  # Use static users from users.json"
echo "  ./load-tests/run-load-test.sh -f flash_sale_enhanced.js -- \\"
echo "    USE_DYNAMIC_USERS=false \\"
echo "    DEBUG=true \\"
echo "    PEAK_VUS_ADD_CART=3 \\"
echo "    PEAK_VUS_PLACE_ORDER=3 \\"
echo "    PEAK_VUS_CANCEL_ORDER=1 \\"
echo "    FLASH_SALE_DURATION=40s"
echo ""