# Intelligent Application Rebuild Detection

The `start-all-optimized.sh` script now includes sophisticated application code change detection and automatic rebuilding capabilities to ensure your Docker containers always run the latest code.

## 🎯 Features

### Automatic Change Detection
The script uses multiple methods to detect when your application code has changed:

1. **Hash-based Detection (Most Reliable)**
   - Generates SHA256 hash of all source files
   - Stores hash in `.build-hash` file for comparison
   - Detects any changes in TypeScript, JavaScript, JSON, and Proto files

2. **Git Status Detection**
   - Checks for uncommitted changes in source files
   - Automatically triggers rebuild if uncommitted changes are detected

3. **File Timestamp Detection**
   - Compares file modification times with Docker image creation time
   - Checks key files: `package.json`, `package-lock.json`, `Dockerfile`, etc.

4. **Dependency Change Detection**
   - Monitors `package-lock.json` for dependency changes
   - Triggers rebuild when dependencies are updated

### Command Line Options

```bash
# Normal startup with automatic rebuild check
./start-all-optimized.sh

# Force rebuild regardless of changes
./start-all-optimized.sh --force-rebuild

# Skip rebuild check for faster startup
./start-all-optimized.sh --skip-rebuild-check

# Show help
./start-all-optimized.sh --help
```

## 🔍 Detection Logic

### When Rebuild is Triggered

1. **Image doesn't exist** - First time build
2. **Source hash changed** - Any source file modified
3. **Uncommitted changes** - Git working directory has changes
4. **Dependencies updated** - `package-lock.json` is newer than image
5. **Dockerfile modified** - Build configuration changed
6. **Force rebuild requested** - `--force-rebuild` flag used

### Files Monitored

- **Source Directories**: `apps/`, `libs/`
- **Configuration Files**: `package.json`, `package-lock.json`, `tsconfig.json`, `nest-cli.json`
- **Build Files**: `Dockerfile`
- **Source Extensions**: `.ts`, `.js`, `.json`, `.proto`

## 🚀 Usage Examples

### Development Workflow
```bash
# Make code changes
vim apps/inventory/src/inventory.service.ts

# Start services (will auto-detect changes and rebuild)
./start-all-optimized.sh
```

### CI/CD Pipeline
```bash
# Always rebuild in CI/CD
./start-all-optimized.sh --force-rebuild
```

### Quick Testing
```bash
# Skip rebuild for faster startup during testing
./start-all-optimized.sh --skip-rebuild-check
```

## 📁 Files Created

- `.build-hash` - Stores source code hash for change detection (auto-generated, git-ignored)

## 🔧 Technical Details

### Hash Generation
- Uses SHA256 for reliable change detection
- Includes all source files and key configuration files
- Fallback mechanisms for different operating systems

### Performance Optimization
- Hash-based detection is faster than timestamp comparison
- Skips detailed checks when force rebuild is requested
- Caches results to avoid redundant operations

### Error Handling
- Graceful fallback when hash tools are unavailable
- Clear error messages for build failures
- Automatic cleanup of temporary files

## 🎛️ Configuration

The rebuild detection can be customized by modifying these variables in the script:

```bash
# Files and directories to monitor
source_dirs=("apps" "libs" "package.json" "package-lock.json" "tsconfig.json" "nest-cli.json" "Dockerfile")

# File extensions to include
file_extensions=("*.ts" "*.js" "*.json" "*.proto")
```

## 🐛 Troubleshooting

### Force Rebuild Not Working
```bash
# Check if image exists
docker images | grep oms-app-base

# Manually remove image
docker rmi oms-app-base:latest

# Try again
./start-all-optimized.sh --force-rebuild
```

### Hash Detection Issues
```bash
# Check if hash tools are available
which sha256sum || which shasum

# Manually check hash file
cat .build-hash
```

### Build Failures
```bash
# Check dependencies
npm install

# Check TypeScript compilation
npm run build

# Check Docker build manually
docker build -t oms-app-base:latest .
```

## 🔄 Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Start OMS with rebuild
  run: ./start-all-optimized.sh --force-rebuild
```

### Jenkins Pipeline Example
```groovy
stage('Deploy') {
    steps {
        sh './start-all-optimized.sh --force-rebuild'
    }
}
```

This intelligent rebuild system ensures that your development workflow is both efficient and reliable, automatically handling code changes while providing flexibility for different deployment scenarios.
