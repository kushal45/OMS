# Jenkins Setup Guide for OMS Deployment
## Local Jenkins → EC2 Deployment Architecture

This guide sets up Jenkins running **locally on your development machine** to deploy to **remote EC2 instance**.

```
[Your Local Machine]
    ↓ (Jenkins Container)
    ↓ (Build & Push to Docker Hub)
    ↓ (SSH to EC2)
[EC2 Instance] (Application Deployment)
```

## Prerequisites

1. **AWS Account** with EC2 access
2. **Docker Hub Account** for container registry
3. **Docker installed locally** for running Jenkins
4. **SSH Key Pair** for EC2 access
5. **Git repository** with your OMS code

## Step 1: AWS Infrastructure Setup

### 1.1 Deploy CloudFormation Stack

```bash
# Deploy the infrastructure
aws cloudformation create-stack \
  --stack-name oms-infrastructure \
  --template-body file://aws-setup/cloudformation-template.yaml \
  --parameters ParameterKey=KeyPairName,ParameterValue=your-key-pair-name \
               ParameterKey=AllowedSSHCIDR,ParameterValue=your-ip/32 \
  --capabilities CAPABILITY_IAM

# Wait for stack creation
aws cloudformation wait stack-create-complete --stack-name oms-infrastructure

# Get outputs
aws cloudformation describe-stacks --stack-name oms-infrastructure --query 'Stacks[0].Outputs'
```

### 1.2 Configure EC2 Instance

After the CloudFormation stack is created:

1. **Connect to EC2 instance:**
   ```bash
   ssh -i your-key.pem ec2-user@<EC2_PUBLIC_IP>
   ```

2. **Set up application directory:**
   ```bash
   cd /home/ec2-user/oms

   # Copy docker-compose files
   # You'll need to copy these files to the EC2 instance
   ```

3. **Create production environment file:**
   ```bash
   # Copy .env.production to EC2 and update values
   cp .env.production .env

   # Edit the file with actual values
   nano .env
   ```

## Step 2: Local Jenkins Setup

### 2.1 Start Jenkins Locally

From your project directory:

```bash
# Start Jenkins using Docker Compose
docker-compose -f docker-compose.jenkins.yml up -d

# Check if Jenkins is running
docker ps | grep jenkins

# Get initial admin password
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

### 2.2 Access Jenkins

1. **Open browser**: http://localhost:8080
2. **Enter admin password** from step 2.1
3. **Install suggested plugins**
4. **Create admin user**

### 2.3 Install Required Plugins

Install these Jenkins plugins:
- Docker Pipeline
- SSH Agent
- Credentials Binding
- Pipeline
- Git
- Blue Ocean (optional, for better UI)

### 2.2 Configure Credentials

#### Docker Hub Credentials
1. Go to **Manage Jenkins** → **Manage Credentials**
2. Add **Username with password** credential:
   - ID: `dockerhub`
   - Username: Your Docker Hub username
   - Password: Your Docker Hub password or access token

#### EC2 SSH Key
1. Add **SSH Username with private key** credential:
   - ID: `ec2-ssh-key`
   - Username: `ec2-user`
   - Private Key: Your EC2 key pair private key content

### 2.3 Configure Global Environment Variables

Go to **Manage Jenkins** → **Configure System** → **Global Properties** → **Environment variables**:

- `DOCKERHUB_USERNAME`: Your Docker Hub username
- `EC2_HOST`: Your EC2 instance public IP
- `EC2_USER`: `ec2-user`

### 2.4 Create Pipeline Job

1. **New Item** → **Pipeline**
2. **Pipeline Definition**: Pipeline script from SCM
3. **SCM**: Git
4. **Repository URL**: Your Git repository URL
5. **Script Path**: `Jenkinsfile`

## Step 3: Docker Hub Setup

### 3.1 Create Repository

1. Log in to Docker Hub
2. Create a new repository: `your-username/oms-app`
3. Make it public (for free tier) or private (if you have a paid plan)

### 3.2 Update Environment Variables

Update the following in your Jenkins environment or .env.production:
```bash
DOCKER_IMAGE_NAME=your-dockerhub-username/oms-app
```

## Step 4: Security Configuration

### 4.1 EC2 Security Group Rules

Ensure your security group allows:
- SSH (port 22) from your IP
- HTTP (port 3000) from anywhere (0.0.0.0/0) for the application
- HTTPS (port 443) if using SSL

### 4.2 Environment Variables Security

**Important**: Update these in your production environment:

```bash
# Generate secure passwords
JWT_SECRET=$(openssl rand -base64 32)
POSTGRES_PASSWORD=$(openssl rand -base64 16)

# Update .env.production on EC2
echo "JWT_SECRET=$JWT_SECRET" >> .env.production
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD" >> .env.production
```

## Step 5: Deployment Process

### 5.1 Initial Deployment

1. **Push code to Git repository**
2. **Trigger Jenkins build** (manual or webhook)
3. **Monitor build progress** in Jenkins console
4. **Verify deployment** by accessing `http://<EC2_IP>:3000`

### 5.2 Automated Deployments

Set up webhooks in your Git repository to trigger Jenkins builds on:
- Push to main/master branch
- Pull request merges

## Step 6: Monitoring and Maintenance

### 6.1 Health Checks

The pipeline includes automated health checks. You can also manually check:

```bash
# SSH to EC2
ssh -i your-key.pem ec2-user@<EC2_IP>

# Run health check script
./health-check.sh

# Check container status
docker ps

# Check logs
docker-compose logs -f gateway
```

### 6.2 Log Management

Logs are automatically rotated. To view logs:

```bash
# Application logs
docker-compose logs -f [service-name]

# System logs
tail -f /var/log/messages

# Docker logs
journalctl -u docker
```

## Troubleshooting

### Common Issues

1. **Build fails with "Docker not found"**
   - Ensure Jenkins has Docker installed and user has permissions

2. **SSH connection fails**
   - Check security group rules
   - Verify SSH key is correct
   - Ensure EC2 instance is running

3. **Application not accessible**
   - Check security group port 3000 is open
   - Verify containers are running: `docker ps`
   - Check application logs: `docker-compose logs`

4. **Out of memory errors**
   - Monitor memory usage: `free -h`
   - Consider upgrading instance type
   - Optimize Docker resource limits

### Performance Optimization

For t2.micro instances:
- Monitor CPU and memory usage
- Use swap file (already configured in user data)
- Optimize Docker resource limits
- Consider using multi-stage builds for smaller images

## Cost Optimization

- Use AWS Free Tier eligible resources
- Stop EC2 instance when not needed (development)
- Use spot instances for non-production environments
- Monitor AWS billing dashboard

## Next Steps

1. **SSL/TLS Setup**: Configure HTTPS with Let's Encrypt
2. **Domain Setup**: Configure custom domain with Route 53
3. **Load Balancer**: Add Application Load Balancer for high availability
4. **Database Backup**: Set up automated PostgreSQL backups
5. **Monitoring**: Integrate with CloudWatch or external monitoring tools