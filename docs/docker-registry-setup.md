# Docker Registry Setup Guide

This guide covers setting up Docker Hub and AWS ECR for the OMS application deployment.

## Option 1: Docker Hub (Recommended for Free Tier)

### 1.1 Create Docker Hub Account

1. Go to [Docker Hub](https://hub.docker.com/)
2. Sign up for a free account
3. Verify your email address

### 1.2 Create Repository

1. **Log in to Docker Hub**
2. **Click "Create Repository"**
3. **Repository Details:**
   - Name: `oms-app`
   - Description: `Order Management System - Microservices Application`
   - Visibility: Public (free) or Private (paid)

### 1.3 Generate Access Token

For security, use access tokens instead of passwords:

1. **Go to Account Settings** → **Security**
2. **Click "New Access Token"**
3. **Token Description:** `Jenkins CI/CD`
4. **Permissions:** Read, Write, Delete
5. **Copy the token** (you won't see it again)

### 1.4 Test Docker Hub Access

```bash
# Login to Docker Hub
docker login -u your-username

# Build and push test image
docker build -t your-username/oms-app:test .
docker push your-username/oms-app:test

# Verify image is available
docker pull your-username/oms-app:test
```

## Option 2: AWS ECR (Alternative)

### 2.1 Create ECR Repository

```bash
# Create ECR repository
aws ecr create-repository \
    --repository-name oms-app \
    --region us-east-1

# Get repository URI
aws ecr describe-repositories \
    --repository-names oms-app \
    --region us-east-1 \
    --query 'repositories[0].repositoryUri' \
    --output text
```

### 2.2 Configure ECR Authentication

```bash
# Get ECR login token
aws ecr get-login-password --region us-east-1 | \
docker login --username AWS --password-stdin \
<account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and tag image for ECR
docker build -t oms-app .
docker tag oms-app:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/oms-app:latest

# Push to ECR
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/oms-app:latest
```

### 2.3 ECR IAM Permissions

Create IAM policy for Jenkins to access ECR:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "ecr:GetAuthorizationToken",
                "ecr:BatchCheckLayerAvailability",
                "ecr:GetDownloadUrlForLayer",
                "ecr:BatchGetImage",
                "ecr:PutImage",
                "ecr:InitiateLayerUpload",
                "ecr:UploadLayerPart",
                "ecr:CompleteLayerUpload"
            ],
            "Resource": "*"
        }
    ]
}
```

## Jenkins Integration

### For Docker Hub

Update Jenkins environment variables:
```bash
DOCKERHUB_USERNAME=your-docker-hub-username
DOCKER_IMAGE_NAME=your-docker-hub-username/oms-app
```

Add credentials in Jenkins:
- ID: `dockerhub`
- Type: Username with password
- Username: Your Docker Hub username
- Password: Your access token (not password)

### For AWS ECR

Update Jenkins environment variables:
```bash
AWS_ACCOUNT_ID=your-aws-account-id
AWS_REGION=us-east-1
ECR_REPOSITORY_URI=<account-id>.dkr.ecr.us-east-1.amazonaws.com/oms-app
```

Add AWS credentials in Jenkins:
- ID: `aws-credentials`
- Type: AWS Credentials
- Access Key ID: Your AWS access key
- Secret Access Key: Your AWS secret key

## Docker Compose Configuration

### For Docker Hub

Update `docker-compose.app.slim.yml`:
```yaml
services:
  gateway:
    image: ${DOCKER_IMAGE_NAME:-your-username/oms-app:latest}
    # ... rest of configuration
```

### For AWS ECR

Update `docker-compose.app.slim.yml`:
```yaml
services:
  gateway:
    image: ${ECR_REPOSITORY_URI:-123456789012.dkr.ecr.us-east-1.amazonaws.com/oms-app:latest}
    # ... rest of configuration
```

## Image Optimization

### Multi-stage Dockerfile

Your current Dockerfile already uses multi-stage builds. Additional optimizations:

```dockerfile
# Use specific versions for reproducibility
FROM node:21-alpine AS builder

# Use .dockerignore to exclude unnecessary files
# Create .dockerignore file:
```

Create `.dockerignore`:
```
node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.nyc_output
coverage
.nyc_output
.coverage
.coverage/
dist
.DS_Store
*.log
```

### Image Size Optimization

```bash
# Check image size
docker images your-username/oms-app

# Analyze image layers
docker history your-username/oms-app:latest

# Use dive tool for detailed analysis
docker run --rm -it \
  -v /var/run/docker.sock:/var/run/docker.sock \
  wagoodman/dive:latest your-username/oms-app:latest
```

## Security Best Practices

### 1. Use Access Tokens

- Never use passwords in CI/CD
- Rotate access tokens regularly
- Use minimal required permissions

### 2. Image Scanning

```bash
# Scan for vulnerabilities (Docker Hub)
docker scan your-username/oms-app:latest

# Scan with Trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image your-username/oms-app:latest
```

### 3. Image Signing

```bash
# Enable Docker Content Trust
export DOCKER_CONTENT_TRUST=1

# Sign and push image
docker push your-username/oms-app:latest
```

## Monitoring and Maintenance

### Registry Cleanup

```bash
# Remove old images locally
docker image prune -a

# For Docker Hub - use retention policies
# For ECR - set lifecycle policies
```

### ECR Lifecycle Policy Example

```json
{
    "rules": [
        {
            "rulePriority": 1,
            "description": "Keep last 10 images",
            "selection": {
                "tagStatus": "tagged",
                "countType": "imageCountMoreThan",
                "countNumber": 10
            },
            "action": {
                "type": "expire"
            }
        }
    ]
}
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   ```bash
   # Check credentials
   docker login

   # For ECR, refresh token
   aws ecr get-login-password --region us-east-1 | \
   docker login --username AWS --password-stdin \
   <account-id>.dkr.ecr.us-east-1.amazonaws.com
   ```

2. **Push Denied**
   - Check repository permissions
   - Verify repository name is correct
   - Ensure you have push permissions

3. **Image Not Found**
   - Verify image name and tag
   - Check if repository exists
   - Ensure image was pushed successfully

### Performance Tips

1. **Use Layer Caching**
   - Order Dockerfile commands by change frequency
   - Copy package.json before source code
   - Use multi-stage builds

2. **Parallel Builds**
   - Use BuildKit for faster builds
   - Enable experimental features

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1
docker build -t your-username/oms-app .
```

## Cost Optimization

### Docker Hub
- Free tier: 1 private repository, unlimited public
- Paid plans for more private repositories

### AWS ECR
- Pay for storage and data transfer
- Use lifecycle policies to clean up old images
- Consider cross-region replication costs

## Next Steps

1. **Set up automated vulnerability scanning**
2. **Implement image signing for security**
3. **Configure registry webhooks for notifications**
4. **Set up monitoring for registry usage**
5. **Implement blue-green deployments with multiple image tags**