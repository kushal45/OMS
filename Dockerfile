# ----------------- BASE -----------------
# This stage sets up the basic environment and installs common dependencies.
FROM node:20-alpine AS base
WORKDIR /app

# Install base OS packages needed for both development and production.
# curl is used in dev, wget and postgresql-client in prod. Installing all in base is simpler.
RUN apk add --no-cache curl postgresql-client wget

# Copy package files to leverage Docker layer caching.
COPY package*.json ./

# ----------------- DEVELOPMENT -----------------
# This stage is for local development. It includes all source code and devDependencies.
# Target this stage in docker-compose.dev.yml.
# Example: docker build --target development -t my-app-dev .
FROM base AS development

ENV NODE_ENV=development
RUN npm install
# Ensure local binaries (tsc, ts-node, etc.) are available in PATH
ENV PATH="./node_modules/.bin:$PATH"

# Copy the rest of the application source code
COPY . .

# Default command for development. This will be overridden by docker-compose.
CMD ["npm", "run", "start:dev"]


# ----------------- BUILDER -----------------
# This stage builds the application, creating production-ready artifacts.
# It includes devDependencies because they are needed for the build process.
FROM base AS builder

# Install all dependencies, including devDependencies, which are required for building and testing.
RUN npm install
RUN npm install -g @nestjs/cli
RUN npm install -g dotenv-cli

# Copy the entire source code to have everything for the build.
COPY . .

# Run the build scripts to compile the application.
RUN rm -rf dist && npm run build:all && npm run postbuild:all

# The original Dockerfile.production had these COPY commands. They might be redundant
# if the build process handles them, but we include them for safety to ensure .proto files are present.
COPY apps/cart/src/proto/*.proto dist/apps/cart/src/proto/
COPY apps/inventory/src/proto/*.proto dist/apps/inventory/src/proto/
COPY apps/product/src/proto/*.proto dist/apps/product/src/proto/

# After building, remove the devDependencies from node_modules to reduce the size
# of the final production image.
RUN npm prune --production


# ----------------- PRODUCTION -----------------
# This is the final, lean production image. It only contains the compiled app and runtime dependencies.
# Target this stage for production builds.
# Example: docker build --target production -t my-app-prod .
FROM node:21-alpine AS production

WORKDIR /app

# Install only production-necessary OS packages.
RUN apk add --no-cache postgresql-client wget

# Copy the pruned node_modules from the builder stage.
COPY --from=builder /app/node_modules ./node_modules

# Copy the compiled application code from the builder stage.
COPY --from=builder /app/dist ./dist

# Copy other necessary files like package.json for runtime, and scripts for migrations.
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/nest-cli.json ./nest-cli.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/tsconfig.build.json ./tsconfig.build.json
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/apps/database/seeders/data ./dist/apps/database/seeders/data

EXPOSE 3000

# The command to run the application will be specified in the docker-compose.prod.yml
# or a similar file, as different services run different main files.
# Example CMD: CMD ["node", "dist/apps/api-gateway/src/main.js"]