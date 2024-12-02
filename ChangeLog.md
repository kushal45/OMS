# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-12-02

### Added

- **Common Utilities:**
  - **Success/Error Response Utility:** Added common utilities for sending standardized success and error responses across the application.
- **Database Configuration:**
  - **Auth and Order Microservices:** Set up database configurations for both auth and order microservices to access the database.
- **Database Migration:**
  - **Common Migration Folder:** Created a common database migration folder.
  - **Customer Table Migration:** Migrated the customer table structure to the `oms` database.

- **Custom Logger Service**  Added Custom Logger Service module as a library to be consumed accross the other mono repo projects / libraries for logging purpose and consuming the logs in elastic search

- **Custom ErrorLogger Interceptor** - Addition of custom Error Logger interceptor which uses the custom log service to log the error thrown and return the thrown error as a response to the endpoint along with the status code

- **docker services addition** -

  - ***Elastic Search Cluster:***
    - Added `es01`, `es02`, and `es03` services to form an Elasticsearch cluster.
    - Configured environment variables for cluster setup.
    - Added health checks and volume mappings for persistent data storage.

  - ***Auth Service:***
    - Added `auth` service to handle authentication.
    - Configured environment variables and health checks.
    - Set up dependencies on `postgres` and `es01`.

  - ***Order Service:***
    - Added `order` service to handle order management.
    - Configured environment variables and health checks.
    - Set up dependencies on `postgres` and `es01`.

  - ***Inventory Service:***
    - Added `inventory` service as a basic skeleton for inventory management.
    - Configured environment variables.
    - Set up dependencies on `postgres`.

  - ***Product Service:***
    - Added `product` service as a basic skeleton for product management.
    - Configured environment variables.
    - Set up dependencies on `postgres`.
  - ***health check in docker services*** -  added health check parameters in auth, api-gateway docker service

- **Base Repository:**
  - Added a base repository interface to be implemented by all repositories for handling transactions and improving TypeORM configuration.

- **Customized Swagger Module:**
  - Made the Swagger module more generic and added it as part of the library to be consumed across different monorepo projects.

- migration for address,customerAddress,order table

- **Seeds:**
  - Added seeds for `product` and `inventory` tables to handle initial order CRUD API endpoints.
  
- **Address Service:**
  - Created as a library to be consumed by other monorepo projects like `auth` and `order`.
  - `Auth` consumes it for creating user addresses.
  - `Order` consumes it for creating/updating orders.

### Changed

- No changes in this release.

### Fixed

- No fixes in this release.

### Security

- No security updates in this release.
