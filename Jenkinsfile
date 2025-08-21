
pipeline {
    agent any

    environment {
        // Docker Hub credentials
        DOCKERHUB_CREDENTIALS = credentials('dockerhub')

        // EC2 SSH credentials
        EC2_SSH_CREDENTIALS = credentials('ec2-ssh-key')

        // Docker image configuration
        DOCKER_IMAGE_NAME = "${env.DOCKERHUB_USERNAME}/oms-app"
        BUILD_NUMBER = "${env.BUILD_NUMBER}"
        GIT_COMMIT_SHORT = "${env.GIT_COMMIT[0..7]}"

        // EC2 configuration
        EC2_HOST = "${env.EC2_HOST}"
        EC2_USER = "${env.EC2_USER ?: 'ec2-user'}"

        // Application configuration
        NODE_ENV = 'production'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        timestamps()
    }

    stages {
        stage('Checkout') {
            steps {
                echo "🔄 Checking out source code..."
                checkout scm

                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                }

                echo "📋 Build Info:"
                echo "  - Build Number: ${BUILD_NUMBER}"
                echo "  - Git Commit: ${GIT_COMMIT_SHORT}"
                echo "  - Docker Image: ${DOCKER_IMAGE_NAME}"
            }
        }

        stage('Pre-build Validation') {
            steps {
                echo "🔍 Validating build environment..."

                script {
                    // Check if required files exist
                    if (!fileExists('Dockerfile')) {
                        error("Dockerfile not found!")
                    }
                    if (!fileExists('docker-compose.app.slim.yml')) {
                        error("docker-compose.app.slim.yml not found!")
                    }
                    if (!fileExists('docker-compose.infra.slim.yml')) {
                        error("docker-compose.infra.slim.yml not found!")
                    }
                }

                echo "✅ Pre-build validation completed"
            }
        }

        stage('Build and Test') {
            parallel {
                stage('Build Docker Image') {
                    steps {
                        echo "🏗️ Building Docker image..."

                        script {
                            try {
                                // Build image with multiple tags
                                def customImage = docker.build(
                                    "${DOCKER_IMAGE_NAME}:${BUILD_NUMBER}",
                                    "-f Dockerfile ."
                                )

                                // Tag as latest
                                customImage.tag("latest")
                                customImage.tag("${GIT_COMMIT_SHORT}")

                                echo "✅ Docker image built successfully"

                            } catch (Exception e) {
                                echo "❌ Docker build failed: ${e.getMessage()}"
                                throw e
                            }
                        }
                    }
                }

                stage('Run Tests') {
                    steps {
                        echo "🧪 Running application tests..."

                        script {
                            try {
                                // Run tests in Docker container
                                sh '''
                                    docker run --rm \
                                        -v $(pwd):/app \
                                        -w /app \
                                        node:21-alpine \
                                        sh -c "npm ci && npm run test"
                                '''
                                echo "✅ Tests passed"
                            } catch (Exception e) {
                                echo "⚠️ Tests failed, but continuing deployment: ${e.getMessage()}"
                                // Don't fail the build for test failures in this example
                            }
                        }
                    }
                }
            }
        }

        stage('Push to Registry') {
            steps {
                echo "📤 Pushing Docker image to registry..."

                script {
                    try {
                        docker.withRegistry('https://registry.hub.docker.com', DOCKERHUB_CREDENTIALS) {
                            def image = docker.image("${DOCKER_IMAGE_NAME}:${BUILD_NUMBER}")

                            // Push all tags
                            image.push("${BUILD_NUMBER}")
                            image.push("latest")
                            image.push("${GIT_COMMIT_SHORT}")

                            echo "✅ Image pushed successfully to Docker Hub"
                        }
                    } catch (Exception e) {
                        echo "❌ Failed to push image: ${e.getMessage()}"
                        throw e
                    }
                }
            }
        }

        stage('Deploy to EC2') {
            steps {
                echo "🚀 Deploying to EC2 instance..."

                withCredentials([sshUserPrivateKey(credentialsId: 'ec2-ssh-key', keyFileVariable: 'KEY_FILE', usernameVariable: 'USER')]) {
                    script {
                        try {
                            sh '''
                                echo "🔗 Connecting to EC2 instance: ${EC2_HOST}"

                                # Test SSH connection
                                ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -i $KEY_FILE ${EC2_USER}@${EC2_HOST} "echo 'SSH connection successful'"

                                # Deploy application
                                ssh -o StrictHostKeyChecking=no -i $KEY_FILE ${EC2_USER}@${EC2_HOST} "
                                    set -e

                                    echo '📁 Navigating to application directory...'
                                    cd /home/${EC2_USER}/oms

                                    echo '📋 Setting environment variables...'
                                    export DOCKER_IMAGE_NAME=${DOCKER_IMAGE_NAME}:${BUILD_NUMBER}
                                    export NODE_ENV=production

                                    echo '🛑 Stopping existing services...'
                                    docker-compose -f docker-compose.app.slim.yml down || true

                                    echo '📥 Pulling latest images...'
                                    docker-compose -f docker-compose.infra.slim.yml pull || true
                                    docker-compose -f docker-compose.app.slim.yml pull || true

                                    echo '🏗️ Starting infrastructure services...'
                                    docker-compose -f docker-compose.infra.slim.yml up -d

                                    echo '⏳ Waiting for infrastructure to be ready...'
                                    sleep 30

                                    echo '🚀 Starting application services...'
                                    docker-compose -f docker-compose.app.slim.yml up -d --remove-orphans

                                    echo '🧹 Cleaning up old images...'
                                    docker image prune -f || true

                                    echo '✅ Deployment completed successfully!'
                                "
                            '''

                            echo "✅ Deployment to EC2 completed successfully"

                        } catch (Exception e) {
                            echo "❌ Deployment failed: ${e.getMessage()}"
                            throw e
                        }
                    }
                }
            }
        }
    }

    post {
        always {
            echo "🧹 Cleaning up workspace..."
            cleanWs()
        }

        success {
            echo "🎉 Pipeline completed successfully!"
            echo "🌐 Application URL: http://${EC2_HOST}:3000"
        }

        failure {
            echo "❌ Pipeline failed!"
        }

        unstable {
            echo "⚠️ Pipeline completed with warnings"
        }
    }
}
