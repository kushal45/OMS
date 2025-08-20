# Base Dockerfile for OMS applications
# Stage 1: Build the application
FROM node:21-alpine AS builder

# Install curl and other necessary packages
RUN apk add --no-cache curl

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
COPY nest-cli.json ./

# Install all dependencies including dev dependencies
RUN npm install
# Install NestJS CLI globally for the nest command
RUN npm install -g @nestjs/cli

# Copy TypeScript configuration files
COPY tsconfig*.json ./

# Copy all source code
COPY . .

# Pre-build all applications to ensure TypeScript compilation works
RUN rm -rf dist && npm run build:all && npm run postbuild:all

# Explicitly copy .proto files to their respective dist directories
COPY apps/cart/src/proto/*.proto dist/apps/cart/src/proto/
COPY apps/inventory/src/proto/*.proto dist/apps/inventory/src/proto/
COPY apps/product/src/proto/*.proto dist/apps/product/src/proto/


# Prune development dependencies
# RUN npm prune --production

# Stage 2: Create the production image
FROM node:21-alpine AS production

WORKDIR /app

# Copy only the necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/nest-cli.json ./nest-cli.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig.build.json ./tsconfig.build.json

# Expose the default port
EXPOSE 3000
