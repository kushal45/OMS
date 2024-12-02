# ChangeLog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0]- 2024-12-02

### Added

- new ProxyMiddleware to handle request forwarding to backend services.
- Integrated JWT authentication for secure API access.
- Added routing for API proxy to `auth` and `order` microservice endpoints.
- added Auth MiddleWare which takes care of validating auth Bearer token from auth/ order endpoints
- ProxyMiddleware adding user data header from the decoded JWT token to pass the info to order endpoints

### Changed

- Improved error handling in the API Gateway.
- Enhanced logging for better traceability.

### Fixed

- Fixed an issue where the `ProxyMiddleware` was not logging requests correctly.
- Resolved a bug causing incorrect routing of requests to the `Order` service.
- Fixed a security vulnerability in the JWT authentication implementation.

### Deprecated

- N/A

### Removed

 - api Gateway Controller and service class files which are not required for current implementation

### Security

- N/A

## [main] - 2023-11-10

### Added

- Initial release of the API Gateway monorepo project.
- Implemented basic routing and request forwarding.

### Changed

- N/A

### Fixed

- N/A

### Deprecated

- N/A

### Removed

- N/A

### Security

- N/A

## [0.1.0] - 2023-10-17

### Added

- Project setup and initial configuration.
- Basic structure for the monorepo using NestJS.
- Initial implementation of the Auth microservice.

### Changed

- N/A

### Fixed

- N/A

### Deprecated

- N/A

### Removed

- N/A

### Security

- N/A
