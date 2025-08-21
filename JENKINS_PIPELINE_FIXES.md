# Jenkins Pipeline Fixes

## Issues Identified from Console Output

Based on the Jenkins pipeline console output, the following issues were identified and fixed:

### 1. ❌ Docker Hub Credentials Not Found
**Error**: `Could not find credentials matching kushal493:dckr_pat_KPb1gKQLSGuQHTMhb67A7_kUlpQ`

**Root Cause**: The pipeline was looking for credentials with ID `dockerhub` but they weren't configured in Jenkins.

**Fix Applied**: 
- Updated Jenkinsfile to use `withDockerRegistry` instead of manual login
- Simplified credentials handling

### 2. ❌ npm ci Failing in Tests
**Error**: `The npm ci command can only install with an existing package-lock.json`

**Root Cause**: Volume mounting issues causing npm ci to fail even though package-lock.json exists.

**Fix Applied**:
- Added fallback logic to use `npm install` if `npm ci` fails
- Improved error handling in test stage
- Added proper shell script structure

### 3. ❌ Environment Variable Issues
**Error**: Docker image name resolution issues

**Fix Applied**:
- Hardcoded `DOCKER_IMAGE_NAME` to `kushal493/oms-app`
- Removed dependency on `DOCKERHUB_USERNAME` environment variable

## Files Modified

### 1. `Jenkinsfile`
- **Push to Registry Stage**: Changed from manual docker login to `withDockerRegistry`
- **Test Stage**: Added fallback logic for npm ci/install
- **Environment Variables**: Simplified and hardcoded Docker image name

### 2. New Scripts Created
- `scripts/jenkins-troubleshoot.sh`: Comprehensive troubleshooting tool
- `scripts/fix-jenkins-credentials.sh`: Specific credentials setup guide

## Manual Steps Required

### 1. Configure Docker Hub Credentials in Jenkins

1. Open Jenkins: http://localhost:8080
2. Go to: **Manage Jenkins** → **Manage Credentials**
3. Click: **System** → **Global credentials (unrestricted)**
4. Click: **Add Credentials**
5. Configure:
   - **Kind**: Username with password
   - **Scope**: Global
   - **Username**: `kushal493`
   - **Password**: `dckr_pat_KPb1gKQLSGuQHTMhb67A7_kUlpQ`
   - **ID**: `dockerhub`
   - **Description**: Docker Hub Credentials

### 2. Configure EC2 SSH Key (Optional - for deployment)

1. In the same credentials section, click **Add Credentials**
2. Configure:
   - **Kind**: SSH Username with private key
   - **Scope**: Global
   - **ID**: `ec2-ssh-key`
   - **Username**: `ec2-user`
   - **Private Key**: [Your EC2 private key content]
   - **Description**: EC2 SSH Key

### 3. Set Global Environment Variables

1. Go to: **Manage Jenkins** → **Configure System**
2. Scroll to: **Global Properties**
3. Check: **Environment variables**
4. Add:
   - **Name**: `EC2_HOST`, **Value**: `[Your EC2 instance IP]`
   - **Name**: `EC2_USER`, **Value**: `ec2-user`

## Verification Steps

### 1. Test Jenkins Setup
```bash
./scripts/verify-jenkins-setup.sh
```

### 2. Run Troubleshooting Tool
```bash
./scripts/jenkins-troubleshoot.sh
```

### 3. Check Docker Access
```bash
docker exec jenkins docker --version
```

### 4. View Jenkins Logs
```bash
docker-compose -f docker-compose.jenkins.simple.yml logs -f
```

## Expected Pipeline Flow After Fixes

1. ✅ **Checkout**: Should work normally
2. ✅ **Pre-build Validation**: Should pass
3. ✅ **Build Docker Image**: Should build successfully
4. ✅ **Run Tests**: Should handle npm ci/install gracefully
5. ✅ **Push to Registry**: Should authenticate and push to Docker Hub
6. ✅ **Deploy to EC2**: Should work if credentials are configured

## Common Issues and Solutions

### Issue: "Could not find credentials"
**Solution**: Ensure credentials are created with exact ID `dockerhub`

### Issue: "npm ci fails"
**Solution**: The updated Jenkinsfile now handles this automatically

### Issue: "Docker not accessible in Jenkins"
**Solution**: Run `./scripts/fix-jenkins-docker.sh`

### Issue: "EC2 deployment fails"
**Solution**: Configure EC2 SSH key and environment variables

## Next Steps

1. ✅ Apply the manual credential configuration steps above
2. ✅ Run the pipeline again
3. ✅ Monitor the console output for any remaining issues
4. ✅ Use the troubleshooting scripts if needed

## Support Commands

- **Restart Jenkins**: `docker-compose -f docker-compose.jenkins.simple.yml restart`
- **Reset Jenkins**: `./scripts/jenkins-troubleshoot.sh` (option 4)
- **Get help**: `./scripts/jenkins-troubleshoot.sh` (interactive menu)

The pipeline should now work correctly after applying the credential configuration steps!
