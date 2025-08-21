#!/bin/bash
# Copy per-app .env files to dist/apps/<app> after build

set -e

for app in auth order api-gateway inventory product cart; do
  if [ -f "apps/$app/.env" ]; then
    cp "apps/$app/.env" "dist/apps/$app/.env"
  fi
  if [ -f "apps/$app/.env.example" ]; then
    cp "apps/$app/.env.example" "dist/apps/$app/.env.example"
  fi
  if [ -d "apps/$app/proto" ]; then
    mkdir -p "dist/apps/$app/proto"
    cp apps/$app/proto/*.proto dist/apps/$app/proto/ 2>/dev/null || true
  fi

done

echo "Copied .env, .env.example, and proto files to dist/apps/<app> directories."
