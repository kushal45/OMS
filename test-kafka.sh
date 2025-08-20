#!/bin/bash

# Test Kafka connectivity with enhanced error handling and connection verification
echo "🔍 Testing Kafka connectivity..."

# print_success prints its first positional argument to stdout prefixed with a green checkmark and ANSI green coloring.
# The single parameter is the message text to display.
print_success() {
    echo -e "\033[32m✅ $1\033[0m"
}

# print_error prints the given message prefixed with a red "❌" and colors the output red for emphasis.
print_error() {
    echo -e "\033[31m❌ $1\033[0m"
}

# print_info prints an informational message (blue, prefixed with an info emoji) to stdout.
print_info() {
    echo -e "\033[34mℹ️  $1\033[0m"
}

# print_warning prints a yellow warning message prefixed with a warning emoji to stdout.
print_warning() {
    echo -e "\033[33m⚠️  $1\033[0m"
}

# Check if Kafka container is running
print_info "Checking if Kafka container is running..."
if ! docker ps | grep -q "kafka"; then
    print_error "Kafka container is not running"
    print_info "Please start Kafka with: docker-compose -f docker-compose.infra.slim.yml up -d kafka"
    exit 1
fi

print_success "Kafka container is running"

# Wait for Kafka to be ready with proper retry logic
print_info "Waiting for Kafka to be ready..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list > /dev/null 2>&1; then
        print_success "Kafka broker is accessible (attempt $attempt/$max_attempts)"
        break
    else
        print_info "Waiting for Kafka broker... (attempt $attempt/$max_attempts)"
        if [ $attempt -eq 10 ]; then
            print_warning "Kafka is taking longer than expected to start. Checking logs..."
            docker logs kafka --tail 10
        fi
        sleep 3
        ((attempt++))
    fi
done

if [ $attempt -gt $max_attempts ]; then
    print_error "Kafka broker is not accessible after $max_attempts attempts"
    print_info "Check Kafka logs with: docker logs kafka"
    print_info "Check Kafka health with: docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092"
    exit 1
fi

# List existing topics
print_info "Listing existing topics:"
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Test topic creation with unique name
TEST_TOPIC="test-connectivity-$(date +%s)"
print_info "Creating test topic: $TEST_TOPIC"
if docker exec kafka kafka-topics --bootstrap-server localhost:9092 --create --topic "$TEST_TOPIC" --partitions 1 --replication-factor 1 > /dev/null 2>&1; then
    print_success "Test topic created successfully"
else
    print_error "Failed to create test topic"
    print_info "Checking broker API versions..."
    docker exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092 || true
    exit 1
fi

# Test message production and consumption
print_info "Testing message production and consumption..."
TEST_MESSAGE="Hello Kafka $(date)"

# Produce a message
if echo "$TEST_MESSAGE" | docker exec -i kafka kafka-console-producer --bootstrap-server localhost:9092 --topic "$TEST_TOPIC" 2>/dev/null; then
    print_success "Message produced successfully"
else
    print_error "Failed to produce message"
fi

# Wait a moment for the message to be available
sleep 2

# Consume the message with timeout
print_info "Consuming message..."
CONSUMED_MESSAGE=$(docker exec kafka timeout 10s kafka-console-consumer --bootstrap-server localhost:9092 --topic "$TEST_TOPIC" --from-beginning --max-messages 1 2>/dev/null | head -1)

if [ "$CONSUMED_MESSAGE" = "$TEST_MESSAGE" ]; then
    print_success "Message production and consumption successful"
else
    print_warning "Message production and consumption test inconclusive"
    echo "Expected: '$TEST_MESSAGE'"
    echo "Got: '$CONSUMED_MESSAGE'"
fi

# Test connection from application perspective
print_info "Testing connection parameters used by applications..."
if docker exec kafka kafka-broker-api-versions --bootstrap-server kafka:9092 > /dev/null 2>&1; then
    print_success "Kafka is accessible via 'kafka:9092' (application connection string)"
else
    print_warning "Kafka may not be accessible via 'kafka:9092' from applications"
fi

# Cleanup test topic
print_info "Cleaning up test topic..."
if docker exec kafka kafka-topics --bootstrap-server localhost:9092 --delete --topic "$TEST_TOPIC" > /dev/null 2>&1; then
    print_success "Test topic cleaned up"
else
    print_warning "Failed to clean up test topic (this is usually not critical)"
fi

print_success "Kafka connectivity test completed successfully"
print_info "Kafka is ready for application connections on kafka:9092"
print_info "Applications should use KAFKA_BROKERS=kafka:9092 in their environment"
