
pipeline {
    agent any

    environment {
        // Docker image configuration
        DOCKER_IMAGE_NAME = "kushal493/oms-app"
        BUILD_NUMBER = "${env.BUILD_NUMBER}"
        GIT_COMMIT_SHORT = "${env.GIT_COMMIT[0..7]}"

        // EC2 configuration
        EC2_USER = "ubuntu"
        // EC2_HOST is now set dynamically in the 'Deploy Infrastructure' stage

        // CloudFormation configuration
        CFN_STACK_NAME = "oms-stack-${env.BUILD_NUMBER}"
        CFN_KEY_PAIR_NAME = "your-key-pair-name" // IMPORTANT: Configure this in Jenkins or as a job parameter
        CFN_EXPOSE_ALL_SERVICES = "true"
        AWS_REGION = "us-east-1" // IMPORTANT: Set your desired AWS region

        // Application configuration
        NODE_ENV = 'production'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 45, unit: 'MINUTES') // Increased timeout for CFN deployment
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

        stage('Deploy Infrastructure') {
            steps {
                echo "🚀 Deploying CloudFormation stack..."

                script {
                    // Ensure jq is installed on the agent
                    sh "command -v jq >/dev/null 2>&1 || { echo >&2 'jq is not installed. Aborting.'; exit 1; }"

                    // IMPORTANT: 'aws-credentials' must be configured in Jenkins
                    withAWS(credentials: 'aws-credentials', region: "${AWS_REGION}") {
                        sh """
                            aws cloudformation deploy \
                                --template-file aws-setup/cloudformation-template.yaml \
                                --stack-name ${CFN_STACK_NAME} \
                                --parameter-overrides KeyPairName=${CFN_KEY_PAIR_NAME} ExposeAllServices=${CFN_EXPOSE_ALL_SERVICES} \
                                --capabilities CAPABILITY_IAM \
                                --no-fail-on-empty-changeset
                        ""

                        echo "✅ CloudFormation stack deployment initiated."
                        echo "⏳ Waiting for stack completion..."

                        // Get the public IP from the stack outputs
                        def stackOutputs = sh(
                            script:
                                """
                                aws cloudformation describe-stacks --stack-name ${CFN_STACK_NAME} --query 'Stacks[0].Outputs'
                            """,
                            returnStdout: true
                        ).trim()

                        // Use Groovy to parse the JSON output
                        def outputs = readJSON text: stackOutputs
                        def publicIpOutput = outputs.find { it.OutputKey == 'PublicIP' }

                        if (publicIpOutput && publicIpOutput.OutputValue) {
                            env.EC2_HOST = publicIpOutput.OutputValue
                            echo "✅ EC2 instance is ready at: ${env.EC2_HOST}"
                        } else {
                            error "❌ Could not retrieve PublicIP from CloudFormation stack outputs."
                        }
                    }
                }
            }
        }

        stage('Build and Test') {
            parallel {
                stage('Build Docker Image') {
                    steps {
                        echo "🏗️ Building Docker image..."
                        // Same as before
                    }
                }
                stage('Run Tests') {
                    steps {
                        echo "🧪 Running application tests..."
                        // Same as before
                    }
                }
            }
        }

        stage('Push to Registry') {
            steps {
                echo "📤 Pushing Docker image to registry..."
                // Same as before
            }
        }

        stage('Deploy to EC2') {
            steps {
                echo "🚀 Deploying to EC2 instance at ${env.EC2_HOST}..."

                withCredentials([sshUserPrivateKey(credentialsId: 'ec2-ssh-key', keyFileVariable: 'KEY_FILE', usernameVariable: 'USER')]) {
                    script {
                        // Wait for SSH to be ready
                        sh "sleep 60" // Give the instance some time to initialize sshd

                        try {
                            sh """
                                # Test SSH connection
                                ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20 -i $KEY_FILE ${EC2_USER}@${env.EC2_HOST} "echo 'SSH connection successful'"

                                # Deploy application
                                ssh -o StrictHostKeyChecking=no -i $KEY_FILE ${EC2_USER}@${env.EC2_HOST} "
                                    set -e
                                    
                                    echo '📁 Creating application directory if it does not exist...'
                                    if [ ! -d "/home/${EC2_USER}/oms" ]; then
                                        echo "Creating directory /home/${EC2_USER}/oms"
                                        mkdir -p "/home/${EC2_USER}/oms"
                                    fi

                                    echo '📁 Navigating to application directory...'
                                    cd /home/${EC2_USER}/oms

                                    echo '📋 Setting environment variables...'
                                    export DOCKER_IMAGE_NAME=${DOCKER_IMAGE_NAME}:${BUILD_NUMBER}
                                    export NODE_ENV=production

                                    echo '🛑 Stopping existing services...'
                                    docker-compose -f docker-compose.app.slim.yml -f docker-compose.infra.slim.yml down || true

                                    echo '📥 Pulling latest images...'
                                    docker-compose -f docker-compose.infra.slim.yml -f docker-compose.app.slim.yml pull || true

                                    echo '🚀 Starting all services (infra and app)...'
                                    docker-compose -f docker-compose.infra.slim.yml -f docker-compose.app.slim.yml up -d --remove-orphans

                                    echo '🧹 Cleaning up old images...'
                                    docker image prune -f || true

                                    echo '✅ Deployment completed successfully!'
                                "
                            ""

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
            echo "🌐 Application URL: http://${env.EC2_HOST}:3000"
        }

        failure {
            echo "❌ Pipeline failed!"
        }

        unstable {
            echo "⚠️ Pipeline completed with warnings"
        }

        // Optional: Add a stage to tear down the CloudFormation stack
        // cleanup {
        //     echo "🗑️ Tearing down CloudFormation stack..."
        //     withAWS(credentials: 'aws-credentials', region: "${AWS_REGION}") {
        //         sh "aws cloudformation delete-stack --stack-name ${CFN_STACK_NAME}"
        //     }
        // }
    }
}
