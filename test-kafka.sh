#!/bin/bash

# Simple Kafka test script
echo "Testing Kafka connectivity..."

# Check if Kafka container is running
if ! docker ps | grep -q "kafka"; then
    echo "❌ Kafka container is not running"
    exit 1
fi

echo "✅ Kafka container is running"

# Test basic connectivity
echo "Testing basic connectivity..."
if docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list >/dev/null 2>&1; then
    echo "✅ Kafka is responding to basic commands"
else
    echo "❌ Kafka is not responding to basic commands"
    exit 1
fi

# Test topic creation
echo "Testing topic creation..."
if docker exec kafka kafka-topics --bootstrap-server localhost:9092 --create --topic test-topic --partitions 1 --replication-factor 1 --if-not-exists >/dev/null 2>&1; then
    echo "✅ Kafka can create topics"
else
    echo "❌ Kafka cannot create topics"
    exit 1
fi

# List topics to verify
echo "Listing topics..."
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list

# Clean up test topic
echo "Cleaning up test topic..."
docker exec kafka kafka-topics --bootstrap-server localhost:9092 --delete --topic test-topic >/dev/null 2>&1 || true

echo "🎉 Kafka is working correctly!"
