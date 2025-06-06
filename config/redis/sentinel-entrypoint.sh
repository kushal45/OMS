#!/bin/sh

# Wait for Redis master to be available
echo "Waiting for Redis master to be available..."
until redis-cli -h redis-master -p 6379 ping > /dev/null 2>&1; do
  echo "Redis master is not available yet. Retrying in 2 seconds..."
  sleep 2
done

echo "Redis master is available. Getting IP address..."
REDIS_MASTER_IP=$(getent hosts redis-master | awk '{ print $1 }')

if [ -z "$REDIS_MASTER_IP" ]; then
  echo "Failed to resolve redis-master IP address"
  exit 1
fi

echo "Redis master IP: $REDIS_MASTER_IP"

# Create a temporary sentinel config with the resolved IP
cat > /tmp/sentinel.conf << EOF
port 26379
bind 0.0.0.0
protected-mode no

# Use the resolved IP address instead of hostname
sentinel monitor omsredisprimary $REDIS_MASTER_IP 6379 2
sentinel down-after-milliseconds omsredisprimary 5000
sentinel parallel-syncs omsredisprimary 1
sentinel failover-timeout omsredisprimary 10000

# If you need authentication, uncomment:
# sentinel auth-pass omsredisprimary yoursecuremasterpassword
EOF

echo "Starting Redis Sentinel with resolved IP..."
exec redis-sentinel /tmp/sentinel.conf