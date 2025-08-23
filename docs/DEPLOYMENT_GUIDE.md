# 🚀 OMS Deployment Guide
## Local Jenkins → AWS EC2 Deployment

This guide walks you through deploying your OMS (Order Management System) application using **Jenkins running locally** on your development machine to deploy to **AWS EC2**.

## 🏗️ Architecture Overview

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Your Local       │    │    Docker Hub       │    │     AWS EC2         │
│   Machine           │    │                     │    │                     │
│                     │    │                     │    │                     │
│  ┌─────────────┐   │    │  ┌─────────────┐   │    │  ┌─────────────┐   │
│  │   Jenkins   │───┼────┼─▶│ OMS Images  │   │    │  │ OMS App     │   │
│  │ Container   │   │    │  │             │   │    │  │ Running     │   │
│  └─────────────┘   │    │  └─────────────┘   │    │  └─────────────┘   │
│                     │    │                     │    │                     │
│  ┌─────────────┐   │    │                     │    │  ┌─────────────┐   │
│  │   Git       │   │    │                     │    │  │ PostgreSQL  │   │
│  │ Repository  │   │    │                     │    │  │ Redis       │   │
│  └─────────────┘   │    │                     │    │  │ Kafka       │   │
│                     │    │                     │    │  └─────────────┘   │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
         │                                                       ▲
         │                                                       │
         └───────────────── SSH Deployment ────────────────────┘
```

## 🌐 Port Configuration Options

Your OMS application has multiple microservices running on different ports:

| Service | Port | Purpose |
|---------|------|---------|
| API Gateway | 3000 | Main entry point, routes to other services |
| Auth Service | 3001 | Authentication and authorization |
| Order Service | 3002 | Order management |
| Inventory Service | 3003 | Inventory management |
| Product Service | 3004 | Product catalog |
| Cart Service | 3005 | Shopping cart |
| PostgreSQL | 5433 | Database (external port) |
| Redis | 6379 | Cache and sessions |

### 🏗️ Architecture Options

#### Option A: API Gateway Pattern (Production - Recommended)
```
Internet → [Port 3000: API Gateway] → Internal Services (3001-3005)
```
- ✅ **More Secure**: Only one entry point exposed
- ✅ **Better Performance**: Gateway handles routing, load balancing
- ✅ **Easier Monitoring**: Centralized logging and metrics
- ✅ **Production Ready**: Follows microservices best practices

#### Option B: Direct Service Access (Development)
```
Internet → [Ports 3000-3005: All Services]
```
- ✅ **Easier Debugging**: Direct access to each service
- ✅ **Development Friendly**: Test individual services
- ⚠️ **Less Secure**: Multiple attack surfaces
- ⚠️ **More Complex**: Need to manage multiple endpoints

## 📋 Prerequisites

### 1. Local Machine Requirements
- ✅ **Docker** installed and running
- ✅ **Git** with your OMS repository
- ✅ **SSH client** for EC2 access
- ✅ **Internet connection** for Docker Hub and AWS

### 2. AWS Requirements
- ✅ **AWS Account** with EC2 access
- ✅ **EC2 Key Pair** created
- ✅ **Basic AWS CLI knowledge** (optional but helpful)

### 3. Docker Hub Requirements
- ✅ **Docker Hub account** (free tier is sufficient)
- ✅ **Repository created** for your OMS images

## 🎯 Quick Start (5 Steps)

### Step 1: Start Jenkins Locally
```bash
# From your OMS project directory
./scripts/start-jenkins-local.sh
```

### Step 2: Set Up AWS EC2

Choose your deployment approach:

#### Option A: Production (API Gateway Only) - Recommended
```bash
aws cloudformation create-stack \
  --stack-name oms-infrastructure \
  --template-body file://aws-setup/cloudformation-template.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=your-key-pair-name \
               ParameterKey=ExposeAllServices,ParameterValue=false \
  --capabilities CAPABILITY_IAM
```

#### Option B: Development (All Services Exposed)
```bash
aws cloudformation create-stack \
  --stack-name oms-infrastructure \
  --template-body file://aws-setup/cloudformation-template.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=your-key-pair-name \
               ParameterKey=ExposeAllServices,ParameterValue=true \
  --capabilities CAPABILITY_IAM
```

### Step 3: Configure Jenkins
1. Open http://localhost:8080
2. Install suggested plugins
3. Add credentials:
   - Docker Hub credentials (ID: `dockerhub`)
   - EC2 SSH key (ID: `ec2-ssh-key`)
4. Set environment variables:
   - `DOCKERHUB_USERNAME`
   - `EC2_HOST` (your EC2 public IP)

### Step 4: Prepare EC2 Instance
```bash
# SSH to your EC2 instance
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>

# Copy deployment files
scp -i your-key.pem docker-compose*.yml .env.production ec2-user@<EC2_PUBLIC_IP>:/home/ec2-user/oms/
```

### Step 5: Run Deployment Pipeline
1. Create a new Pipeline job in Jenkins
2. Point to your Git repository
3. Use the `Jenkinsfile` in your repo
4. Run the pipeline!

## 📖 Detailed Setup Instructions

### 🔧 Local Jenkins Setup

#### 1. Start Jenkins Container
```bash
# Start Jenkins
./scripts/start-jenkins-local.sh

# Access Jenkins
open http://localhost:8080

# Get initial password
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

#### 2. Configure Jenkins
1. **Install Plugins:**
   - Docker Pipeline
   - SSH Agent
   - Credentials Binding
   - Git

2. **Add Credentials:**
   ```
   Manage Jenkins → Manage Credentials → Add Credentials

   Docker Hub:
   - Type: Username with password
   - ID: dockerhub
   - Username: your-docker-hub-username
   - Password: your-docker-hub-token

   EC2 SSH:
   - Type: SSH Username with private key
   - ID: ec2-ssh-key
   - Username: ec2-user
   - Private Key: [paste your EC2 key content]
   ```

3. **Set Global Environment Variables:**
   ```
   Manage Jenkins → Configure System → Global Properties

   DOCKERHUB_USERNAME=your-docker-hub-username
   EC2_HOST=your-ec2-public-ip
   EC2_USER=ec2-user
   ```

### ☁️ AWS EC2 Setup

#### 1. Deploy Infrastructure
```bash
# Create EC2 instance with CloudFormation
aws cloudformation create-stack \
  --stack-name oms-infrastructure \
  --template-body file://aws-setup/cloudformation-template.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=your-key-pair-name \
               ParameterKey=AllowedSSHCIDR,ParameterValue=your-ip/32 \
  --capabilities CAPABILITY_IAM

# Wait for completion
aws cloudformation wait stack-create-complete --stack-name oms-infrastructure

# Get EC2 public IP
aws cloudformation describe-stacks \
  --stack-name oms-infrastructure \
  --query 'Stacks[0].Outputs[?OutputKey==`PublicIP`].OutputValue' \
  --output text
```

#### 2. Configure EC2 Instance
```bash
# SSH to EC2
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>

# The instance is already configured by user data script
# Just verify Docker is running
docker --version
docker-compose --version
```

#### 3. Copy Application Files
```bash
# From your local machine, copy files to EC2
scp -i your-key.pem docker-compose.app.slim.yml ec2-user@<EC2_PUBLIC_IP>:/home/ec2-user/oms/
scp -i your-key.pem docker-compose.infra.slim.yml ec2-user@<EC2_PUBLIC_IP>:/home/ec2-user/oms/
scp -i your-key.pem .env.production ec2-user@<EC2_PUBLIC_IP>:/home/ec2-user/oms/.env
scp -i your-key.pem deploy.sh ec2-user@<EC2_PUBLIC_IP>:/home/ec2-user/oms/
scp -r -i your-key.pem scripts/ ec2-user@<EC2_PUBLIC_IP>:/home/ec2-user/oms/
scp -r -i your-key.pem config/ ec2-user@<EC2_PUBLIC_IP>:/home/ec2-user/oms/
```

### 🐳 Docker Hub Setup

#### 1. Create Repository
1. Go to [Docker Hub](https://hub.docker.com/)
2. Create repository: `your-username/oms-app`
3. Make it public (free) or private (paid)

#### 2. Update Configuration
```bash
# Update .env.production
DOCKER_IMAGE_NAME=your-dockerhub-username/oms-app:latest

# Update Jenkins environment
DOCKERHUB_USERNAME=your-dockerhub-username
```

### 🔄 Pipeline Setup

#### 1. Create Jenkins Pipeline Job
1. **New Item** → **Pipeline**
2. **Pipeline Definition:** Pipeline script from SCM
3. **SCM:** Git
4. **Repository URL:** Your Git repository URL
5. **Credentials:** Add Git credentials if private repo
6. **Script Path:** `Jenkinsfile`

#### 2. Configure Pipeline Parameters (Optional)
Add these parameters to make the pipeline flexible:
- `DOCKER_TAG` (default: `latest`)
- `SKIP_TESTS` (default: `false`)
- `FORCE_DEPLOY` (default: `false`)

## 🚀 Deployment Process

### Automated Deployment Flow
1. **Code Push** → Git repository
2. **Jenkins Trigger** → Webhook or manual
3. **Build Phase:**
   - Checkout code
   - Build Docker image
   - Run tests (optional)
   - Push to Docker Hub
4. **Deploy Phase:**
   - SSH to EC2
   - Pull latest images
   - Stop old containers
   - Start new containers
   - Health checks

### Manual Deployment
```bash
# Trigger from Jenkins UI
1. Go to your pipeline job
2. Click "Build Now"
3. Monitor console output
4. Check deployment status

# Or trigger via CLI
curl -X POST http://localhost:8080/job/oms-deployment/build \
  --user admin:your-api-token
```

## 🔍 Monitoring and Troubleshooting

### Check Deployment Status
```bash
# On EC2 instance
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>

# Check running containers
docker ps

# Check application health
./health-check.sh

# View logs
docker-compose logs -f gateway
```

### Common Issues and Solutions

#### 1. Jenkins Can't Connect to EC2
```bash
# Check security group allows SSH from your IP
# Verify SSH key is correct
# Test manual SSH connection
ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
```

#### 2. Docker Build Fails
```bash
# Check Docker Hub credentials in Jenkins
# Verify Dockerfile syntax
# Check available disk space
```

#### 3. Application Won't Start
```bash
# Check environment variables
./scripts/validate-environment.sh

# Check resource usage
free -h
df -h

# Check service logs
docker-compose logs
```

## 🔒 Security Considerations

### 1. Network Security
- ✅ Security groups restrict access to necessary ports only
- ✅ SSH access limited to your IP
- ✅ Application ports (3000) open to internet for access

### 2. Credential Security
- ✅ Use Jenkins credential store
- ✅ Never commit secrets to Git
- ✅ Use strong passwords and JWT secrets
- ✅ Rotate credentials regularly

### 3. Application Security
- ✅ Run containers as non-root users
- ✅ Use environment variables for configuration
- ✅ Keep Docker images updated
- ✅ Regular security scans

## 💰 Cost Optimization

### AWS Free Tier Usage
- ✅ t2.micro instance (750 hours/month free)
- ✅ 30GB EBS storage (free)
- ✅ Limited data transfer (1GB/month free)

### Tips to Stay Within Free Tier
- Stop EC2 instance when not needed
- Monitor usage in AWS billing dashboard
- Use spot instances for development
- Clean up unused resources

## 🎉 Success Verification

After successful deployment, you should be able to:

1. **Access Application:**
   ```
   http://<EC2_PUBLIC_IP>:3000
   ```

2. **Check All Services:**
   ```bash
   # All services should be healthy
   curl http://<EC2_PUBLIC_IP>:3000/api-gateway/health
   curl http://<EC2_PUBLIC_IP>:3001/auth/health
   curl http://<EC2_PUBLIC_IP>:3002/order/health
   # ... etc
   ```

3. **Monitor Logs:**
   ```bash
   # No critical errors in logs
   docker-compose logs --tail=50
   ```

## 📚 Additional Resources

- [Jenkins Documentation](https://www.jenkins.io/doc/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [Docker Hub Documentation](https://docs.docker.com/docker-hub/)

## 🆘 Getting Help

If you encounter issues:

1. **Check the logs** first
2. **Validate environment** with `./scripts/validate-environment.sh`
3. **Review security groups** and network settings
4. **Test manual deployment** before automation
5. **Check resource usage** on EC2 instance

---

**🎯 You now have a complete CI/CD pipeline running Jenkins locally to deploy your OMS application to AWS EC2!**