#!/bin/bash

# OMS Debug Tools Script
# Provides quick debugging commands for containerized OMS application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# print_status prints an informational message prefixed with `[INFO]` in green; accepts a single string message argument.
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

# print_warning prints a yellow "[WARN]"-prefixed warning message to stdout.
print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# print_error prints an error message prefixed with `[ERROR]` in red to stdout.
print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# print_header prints a blue header line containing the provided text surrounded by `===` and resets terminal color.
print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# check_container checks whether a Docker container with the exact name is currently running.
# Returns 0 if the container is running, 1 otherwise.
check_container() {
    local container_name=$1
    if docker ps --format "table {{.Names}}" | grep -q "^${container_name}$"; then
        return 0
    else
        return 1
    fi
}

# get_container_status prints to stdout a table of containers matching the given name pattern, showing each container's Name, Status, and Ports.
get_container_status() {
    local container_name=$1
    docker ps -a --filter "name=${container_name}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# check_service_health checks an HTTP health endpoint for a local service and reports the result.
# check_service_health attempts a GET to http://localhost:<port><endpoint> (default endpoint "/health"), prints a colored status message, and returns 0 if the request succeeds (HTTP 2xx/3xx), otherwise returns 1.
check_service_health() {
    local service_name=$1
    local port=$2
    local endpoint=${3:-"/health"}
    
    print_header "Checking $service_name Health"
    
    if curl -s -f "http://localhost:${port}${endpoint}" > /dev/null 2>&1; then
        print_status "$service_name is healthy ✅"
        return 0
    else
        print_error "$service_name is unhealthy ❌"
        return 1
    fi
}

# show_logs prints the last N lines of the specified container's logs (defaults to 50 lines) using `docker logs --tail`.
show_logs() {
    local container_name=$1
    local lines=${2:-50}
    
    print_header "Last $lines lines of $container_name logs"
    docker logs --tail "$lines" "$container_name"
}

# follow_logs streams and follows the Docker logs for the specified container name until interrupted (e.g., Ctrl+C).
follow_logs() {
    local container_name=$1
    print_header "Following logs for $container_name (Ctrl+C to stop)"
    docker logs -f "$container_name"
}

# check_env_vars prints environment variables inside the specified container that match DATABASE, JWT, REDIS, NODE, or PORT.
check_env_vars() {
    local container_name=$1
    print_header "Environment Variables for $container_name"
    docker exec "$container_name" env | grep -E "(DATABASE|JWT|REDIS|NODE|PORT)" | sort
}

# test_database checks the OMS PostgreSQL container: verifies the container is running and accepting connections, confirms the 'oms' database exists, and reports the number of tables in its public schema.
test_database() {
    print_header "Testing Database Connectivity"
    
    if check_container "oms-postgres-1"; then
        print_status "PostgreSQL container is running"
        
        # Test connection
        if docker exec oms-postgres-1 pg_isready -U postgres > /dev/null 2>&1; then
            print_status "PostgreSQL is accepting connections ✅"
            
            # Check database exists
            if docker exec oms-postgres-1 psql -U postgres -lqt | cut -d \| -f 1 | grep -qw oms; then
                print_status "OMS database exists ✅"
                
                # Check tables
                table_count=$(docker exec oms-postgres-1 psql -U postgres -d oms -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | xargs)
                print_status "Database has $table_count tables"
            else
                print_error "OMS database does not exist ❌"
            fi
        else
            print_error "PostgreSQL is not accepting connections ❌"
        fi
    else
        print_error "PostgreSQL container is not running ❌"
    fi
}

# test_redis checks that the oms-redis-1 container is running and that `redis-cli PING` returns `PONG`, printing formatted status messages.
test_redis() {
    print_header "Testing Redis Connectivity"
    
    if check_container "oms-redis-1"; then
        print_status "Redis container is running"
        
        if docker exec oms-redis-1 redis-cli ping | grep -q PONG; then
            print_status "Redis is responding ✅"
        else
            print_error "Redis is not responding ❌"
        fi
    else
        print_error "Redis container is not running ❌"
    fi
}

# test_connectivity checks reachability between core OMS services and prints pass/fail status.
# It verifies specific TCP endpoints by running `nc -zv` inside relevant containers:
# - API Gateway -> Auth (auth:3001)
# - API Gateway -> Order (order:3002)
# - Auth -> Database (postgres:5432)
# The function skips a check if the involved containers are not running and emits colored status messages.
test_connectivity() {
    print_header "Testing Inter-Service Connectivity"
    
    # Test API Gateway to Auth
    if check_container "oms-api-gateway-1" && check_container "oms-auth-1"; then
        if docker exec oms-api-gateway-1 nc -zv auth 3001 2>/dev/null; then
            print_status "API Gateway → Auth Service ✅"
        else
            print_error "API Gateway → Auth Service ❌"
        fi
    fi
    
    # Test API Gateway to Order
    if check_container "oms-api-gateway-1" && check_container "oms-order-1"; then
        if docker exec oms-api-gateway-1 nc -zv order 3002 2>/dev/null; then
            print_status "API Gateway → Order Service ✅"
        else
            print_error "API Gateway → Order Service ❌"
        fi
    fi
    
    # Test Auth to Database
    if check_container "oms-auth-1" && check_container "oms-postgres-1"; then
        if docker exec oms-auth-1 nc -zv postgres 5432 2>/dev/null; then
            print_status "Auth Service → Database ✅"
        else
            print_error "Auth Service → Database ❌"
        fi
    fi
}

# show_overview displays an overview of OMS containers, resource usage, and service health.
# It prints a table of oms-* container names, statuses, and ports, shows current docker resource
# usage (CPU, memory, network), and runs health checks for API Gateway, Auth, Order, and Cart.
show_overview() {
    print_header "OMS System Overview"
    
    echo "Container Status:"
    docker ps -a --filter "name=oms-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    echo -e "\nResource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    
    echo -e "\nService Health:"
    check_service_health "API Gateway" 3000 "/api-gateway/health"
    check_service_health "Auth Service" 3001 "/health"
    check_service_health "Order Service" 3002 "/health"
    check_service_health "Cart Service" 3003 "/cart/health"
}

# collect_debug_info creates a timestamped directory (debug-YYYYMMDD-HHMMSS) and gathers container, image, compose, system, network and service logs into files within that directory.
# The directory will contain: containers.txt, images.txt, all-services.log, postgres.log, redis.log, system-usage.txt, networks.txt, and compose-config.yml.
collect_debug_info() {
    local debug_dir="debug-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$debug_dir"
    
    print_header "Collecting Debug Information to $debug_dir"
    
    # Container information
    docker ps -a > "$debug_dir/containers.txt"
    docker images > "$debug_dir/images.txt"
    
    # Logs
    docker-compose logs > "$debug_dir/all-services.log" 2>&1
    docker logs oms-postgres-1 > "$debug_dir/postgres.log" 2>&1
    docker logs oms-redis-1 > "$debug_dir/redis.log" 2>&1
    
    # System information
    docker system df > "$debug_dir/system-usage.txt"
    docker network ls > "$debug_dir/networks.txt"
    
    # Configuration
    docker-compose config > "$debug_dir/compose-config.yml"
    
    print_status "Debug information collected in $debug_dir"
}

# test_jwt checks whether the oms-auth-1 container has JWT_SECRET configured and attempts to sign and verify a short-lived test JWT, printing success or error messages.
# Requires the auth container to be running and Node with the `jsonwebtoken` package available inside that container.
test_jwt() {
    print_header "Testing JWT Token Generation and Validation"
    
    if check_container "oms-auth-1"; then
        # Test JWT secret configuration
        jwt_secret_set=$(docker exec oms-auth-1 node -e "console.log(process.env.JWT_SECRET ? 'SET' : 'NOT_SET')" 2>/dev/null)
        
        if [ "$jwt_secret_set" = "SET" ]; then
            print_status "JWT_SECRET is configured ✅"
            
            # Test token generation and validation
            docker exec oms-auth-1 node -e "
                const jwt = require('jsonwebtoken');
                try {
                    const token = jwt.sign({id: 'test-user', email: 'test@example.com'}, process.env.JWT_SECRET, {expiresIn: '1h'});
                    console.log('Token generated successfully ✅');
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    console.log('Token validated successfully ✅');
                    console.log('Decoded payload:', JSON.stringify(decoded, null, 2));
                } catch (error) {
                    console.error('JWT test failed ❌:', error.message);
                }
            " 2>/dev/null
        else
            print_error "JWT_SECRET is not configured ❌"
        fi
    else
        print_error "Auth service container is not running ❌"
    fi
}

# show_menu displays the interactive main menu for the OMS Debug Tools, listing numbered actions (system overview, health checks, database/Redis tests, connectivity, JWT test, logs, env inspection, debug collection, service restart, and exit).
show_menu() {
    echo -e "\n${BLUE}OMS Debug Tools${NC}"
    echo "=================="
    echo "1. System Overview"
    echo "2. Check Service Health"
    echo "3. Test Database Connectivity"
    echo "4. Test Redis Connectivity"
    echo "5. Test Inter-Service Connectivity"
    echo "6. Test JWT Token"
    echo "7. Show Container Logs"
    echo "8. Follow Container Logs"
    echo "9. Check Environment Variables"
    echo "10. Collect Debug Information"
    echo "11. Restart Services"
    echo "0. Exit"
    echo
}

# restart_services presents an interactive menu to restart all or individual OMS services (api-gateway, auth, order, cart) via docker-compose or return to the main menu.
restart_services() {
    print_header "Restarting Services"
    echo "1. Restart All Services"
    echo "2. Restart API Gateway"
    echo "3. Restart Auth Service"
    echo "4. Restart Order Service"
    echo "5. Restart Cart Service"
    echo "6. Back to Main Menu"
    
    read -p "Select option: " restart_choice
    
    case $restart_choice in
        1) docker-compose restart ;;
        2) docker-compose restart api-gateway ;;
        3) docker-compose restart auth ;;
        4) docker-compose restart order ;;
        5) docker-compose restart cart ;;
        6) return ;;
        *) print_error "Invalid option" ;;
    esac
}

# Main script logic
if [ $# -eq 0 ]; then
    # Interactive mode
    while true; do
        show_menu
        read -p "Select an option: " choice
        
        case $choice in
            1) show_overview ;;
            2) 
                check_service_health "API Gateway" 3000 "/api-gateway/health"
                check_service_health "Auth Service" 3001 "/health"
                check_service_health "Order Service" 3002 "/health"
                check_service_health "Cart Service" 3003 "/cart/health"
                ;;
            3) test_database ;;
            4) test_redis ;;
            5) test_connectivity ;;
            6) test_jwt ;;
            7) 
                echo "Available containers:"
                docker ps --format "{{.Names}}"
                read -p "Enter container name: " container
                read -p "Number of lines (default 50): " lines
                lines=${lines:-50}
                show_logs "$container" "$lines"
                ;;
            8)
                echo "Available containers:"
                docker ps --format "{{.Names}}"
                read -p "Enter container name: " container
                follow_logs "$container"
                ;;
            9)
                echo "Available containers:"
                docker ps --format "{{.Names}}"
                read -p "Enter container name: " container
                check_env_vars "$container"
                ;;
            10) collect_debug_info ;;
            11) restart_services ;;
            0) print_status "Goodbye!"; exit 0 ;;
            *) print_error "Invalid option. Please try again." ;;
        esac
        
        echo
        read -p "Press Enter to continue..."
    done
else
    # Command line mode
    case $1 in
        "overview") show_overview ;;
        "health") 
            check_service_health "API Gateway" 3000 "/api-gateway/health"
            check_service_health "Auth Service" 3001 "/health"
            check_service_health "Order Service" 3002 "/health"
            check_service_health "Cart Service" 3003 "/cart/health"
            ;;
        "database") test_database ;;
        "redis") test_redis ;;
        "connectivity") test_connectivity ;;
        "jwt") test_jwt ;;
        "logs") show_logs "${2:-oms-auth-1}" "${3:-50}" ;;
        "follow") follow_logs "${2:-oms-auth-1}" ;;
        "env") check_env_vars "${2:-oms-auth-1}" ;;
        "collect") collect_debug_info ;;
        *) 
            echo "Usage: $0 [overview|health|database|redis|connectivity|jwt|logs|follow|env|collect]"
            echo "Run without arguments for interactive mode"
            exit 1
            ;;
    esac
fi
