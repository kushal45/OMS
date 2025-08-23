#!/bin/bash

# Script to wait for database migrations to complete
# This script checks if the required tables exist in the database

set -e

# Database connection parameters
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_USERNAME=${DB_USERNAME:-postgres}
DB_PASSWORD=${DB_PASSWORD:-postgres}
DB_NAME=${DB_NAME:-oms}

# Maximum wait time in seconds (5 minutes)
MAX_WAIT=300
WAIT_INTERVAL=5

echo "🔍 Waiting for database migrations to complete..."
echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"

# check_tables returns the number (0–5) of required tables present in the public schema (`product`, `inventory`, `customer`, `order`, `carts`); psql errors are suppressed and the function outputs nothing on failure.
check_tables() {
    # Check if key tables exist (product and inventory are created by migrations)
    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('product', 'inventory', 'customer', 'order', 'carts');
    " 2>/dev/null | tr -d ' ' | tr -d '\n'
}

# check_seed_data returns the number of rows in the `product` table (trimmed string) or an empty string on query failure, used to detect whether seed data has been applied.
check_seed_data() {
    # Check if products table has data (indicates seeding completed)
    PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -t -c "
        SELECT COUNT(*) FROM product LIMIT 1;
    " 2>/dev/null | tr -d ' ' | tr -d '\n'
}

# Wait for database to be ready
echo "⏳ Waiting for database connection..."
start_time=$(date +%s)

while true; do
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    
    if [ $elapsed -gt $MAX_WAIT ]; then
        echo "❌ Timeout waiting for database migrations after ${MAX_WAIT} seconds"
        exit 1
    fi
    
    # Try to connect to database
    if PGPASSWORD=$DB_PASSWORD psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ Database connection established"
        break
    else
        echo "⏳ Database not ready, waiting... (${elapsed}s/${MAX_WAIT}s)"
        sleep $WAIT_INTERVAL
    fi
done

# Wait for migrations to complete
echo "⏳ Waiting for database migrations..."
while true; do
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    
    if [ $elapsed -gt $MAX_WAIT ]; then
        echo "❌ Timeout waiting for database migrations after ${MAX_WAIT} seconds"
        exit 1
    fi
    
    # Check if required tables exist
    table_count=$(check_tables)
    
    if [ "$table_count" -ge "5" ]; then
        echo "✅ Database migrations completed (found $table_count tables)"
        break
    else
        echo "⏳ Migrations in progress, found $table_count/5 tables... (${elapsed}s/${MAX_WAIT}s)"
        sleep $WAIT_INTERVAL
    fi
done

# Wait for seed data
echo "⏳ Waiting for database seeding..."
while true; do
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))
    
    if [ $elapsed -gt $MAX_WAIT ]; then
        echo "⚠️  Timeout waiting for seed data, but migrations are complete. Proceeding..."
        break
    fi
    
    # Check if seed data exists
    if seed_count=$(check_seed_data) && [ "$seed_count" -gt "0" ]; then
        echo "✅ Database seeding completed (found $seed_count products)"
        break
    else
        echo "⏳ Seeding in progress... (${elapsed}s/${MAX_WAIT}s)"
        sleep $WAIT_INTERVAL
    fi
done

echo "🎉 Database is ready for application services!"
exit 0
