#!/bin/bash
# kafka-ready.sh
set -e
KAFKA_BROKER=${1:-localhost:9092}
TIMEOUT=${2:-30}

# Wait for Kafka to have no unavailable partitions
echo "Waiting for Kafka to be ready at $KAFKA_BROKER (timeout: $TIMEOUT seconds)..."
end=$((SECONDS+$TIMEOUT))
while [ $SECONDS -lt $end ]; do
  # Check for unavailable partitions. If the command succeeds and returns no lines, it means no partitions are unavailable.
  UNAVAILABLE_PARTITIONS=$(/usr/bin/kafka-topics --bootstrap-server $KAFKA_BROKER --describe --unavailable-partitions 2>/dev/null)
  
  # Check if kafka-topics command itself failed (e.g., broker not reachable)
  if [ $? -ne 0 ]; then
    echo "Kafka broker at $KAFKA_BROKER not yet reachable or kafka-topics command failed. Retrying..."
  # Check if the output is empty (meaning no unavailable partitions)
  elif [ -z "$UNAVAILABLE_PARTITIONS" ]; then
    echo "Kafka is ready: No unavailable partitions found."
    exit 0
  else
    echo "Kafka not ready yet. Unavailable partitions found:"
    echo "$UNAVAILABLE_PARTITIONS"
  fi
  sleep 3 # Increased sleep time slightly
done

echo "Timeout: Kafka at $KAFKA_BROKER did not become ready within $TIMEOUT seconds."
exit 1
