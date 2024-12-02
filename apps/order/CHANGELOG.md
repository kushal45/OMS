# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2024-12-02

### Added
- **Microservice Separation:**
  - **Order Microservice:** Converted the order microservice to its own `docker-compose` file for better modularity and isolation.
 **Initial CRUD Endpoints:**
  - Added initial CRUD endpoints supporting basic order create, update, fetch, and delete operations without validation from inventory.

- **CRUD API Endpoint Integration:**
  - Integrated CRUD API endpoints with address service and user data for validating addresses.

- **E2E Tests:**
  - Added E2E tests to cover order endpoint use cases with success and failure scenarios.

- **Custom Swagger Module:**
  - Integrated a custom Swagger module which documents sample default values in the request and response object structures for reference.
