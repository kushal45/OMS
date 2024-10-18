# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-10-17

### Added
- **Initial Release of the Auth Microservice:**
- **User Registration Endpoint:** Allows new users to register by providing their details.
- **User Login Endpoint:** Enables users to log in using their credentials.
- **JWT-Based Authentication:** Implements JSON Web Token (JWT) for secure authentication.
- **Basic User Update Endpoint:** Provides functionality for users to update their profile information.
- **Swagger Documentation:** Comprehensive API documentation using Swagger for all endpoints.
- **Request Body Validation:** Ensures data integrity and security using `class-validator` and `class-transformer`.
- **Docker Integration:** Added the microservice to the `docker-compose` file, enabling it to run as a separate microservice inside Docker.
- **Database Integration:** Initial customer table migration and TypeORM setup with PostgreSQL.

### Changed
- No changes in this release.

### Fixed
- No fixes in this release.

### Security
- No security updates in this release.