pipeline {
    agent any

    environment {
        // Docker image configuration
        DOCKER_IMAGE_NAME = "kushal493/oms-app"
        // BUILD_NUMBER and GIT_COMMIT_SHORT will be set in steps
        // EC2 configuration
        EC2_USER = "ubuntu"
        // EC2_HOST will be set dynamically later
        
        // CloudFormation configuration
        CFN_STACK_NAME = "oms-stack-${env.BUILD_NUMBER}"
        CFN_KEY_PAIR_NAME = "your-key-pair-name" // IMPORTANT: Configure this in Jenkins or as a job parameter
        CFN_EXPOSE_ALL_SERVICES = "true"
        AWS_REGION = "us-east-1"
        // Application configuration
        NODE_ENV = 'production'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 45, unit: 'MINUTES')
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
                echo "  - Build Number: ${env.BUILD_NUMBER}"
                echo "  - Git Commit: ${env.GIT_COMMIT_SHORT}"
                echo "  - Docker Image: ${env.DOCKER_IMAGE_NAME}"
            }
        }

        stage('Deploy Infrastructure') {
            steps {
                echo "🚀 Deploying CloudFormation stack..."

                withCredentials([usernamePassword(credentialsId: 'aws-credentials', usernameVariable: 'AWS_ACCESS_KEY_ID', passwordVariable: 'AWS_SECRET_ACCESS_KEY')]) {
                    sh """
                        export AWS_REGION=${env.AWS_REGION}
                        aws cloudformation deploy \
                            --template-file aws-setup/cloudformation-template.yaml \
                            --stack-name ${env.CFN_STACK_NAME} \
                            --parameter-overrides KeyPairName=${env.CFN_KEY_PAIR_NAME} ExposeAllServices=${env.CFN_EXPOSE_ALL_SERVICES} \
                            --capabilities CAPABILITY_IAM \
                            --no-fail-on-empty-changeset
                    """

                    echo "✅ CloudFormation stack deployment initiated."
                    echo "⏳ Waiting for stack completion..."

                    // Get the public IP from the stack outputs
                    script {
                        def stackOutputs = sh(
                            script: "aws cloudformation describe-stacks --stack-name ${env.CFN_STACK_NAME} --query 'Stacks[0].Outputs'",
                            returnStdout: true
                        ).trim()

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
                        // Insert your docker build commands here
                    }
                }
                stage('Run Tests') {
                    steps {
                        echo "🧪 Running application tests..."
                        // Insert your test commands here
                    }
                }
            }
        }

        stage('Push to Registry') {
            steps {
                echo "📤 Pushing Docker image to registry..."
                // Insert your docker push commands here
            }
        }

        stage('Deploy to EC2') {
            steps {
                echo "🚀 Deploying to EC2 instance at ${env.EC2_HOST}..."

                sshagent (credentials: ['ec2-ssh-key']) {
                    // Wait for SSH to be ready
                    sh "sleep 60"

                    // Test SSH connectivity
                    sh """
                        ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20 ${env.EC2_USER}@${env.EC2_HOST} 'echo "SSH connection successful"'
                    """

                    // Deployment to EC2
                    sh """
                        ssh -o StrictHostKeyChecking=no ${env.EC2_USER}@${env.EC2_HOST} '
                            set -e
                            echo "📁 Creating application directory if it does not exist..."
                            if [ ! -d "/home/${env.EC2_USER}/oms" ]; then
                                echo "Creating directory /home/${env.EC2_USER}/oms"
                                mkdir -p "/home/${env.EC2_USER}/oms"
                            fi
                            echo "📁 Navigating to application directory..."
                            cd /home/${env.EC2_USER}/oms
                            echo "📋 Setting environment variables..."
                            export DOCKER_IMAGE_NAME=${env.DOCKER_IMAGE_NAME}:${env.BUILD_NUMBER}
                            export NODE_ENV=production
                            echo "🛑 Stopping existing services..."
                            docker-compose -f docker-compose.app.slim.yml -f docker-compose.infra.slim.yml down || true
                            echo "📥 Pulling latest images..."
                            docker-compose -f docker-compose.infra.slim.yml -f docker-compose.app.slim.yml pull || true
                            echo "🚀 Starting all services (infra and app)..."
                            docker-compose -f docker-compose.infra.slim.yml -f docker-compose.app.slim.yml up -d --remove-orphans
                            echo "🧹 Cleaning up old images..."
                            docker image prune -f || true
                            echo "✅ Deployment completed successfully!"
                        '
                    """
                    echo "✅ Deployment to EC2 completed successfully"
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
        cleanup {
            echo "🗑️ Tearing down CloudFormation stack..."
            withCredentials([usernamePassword(credentialsId: 'aws-credentials', usernameVariable: 'AWS_ACCESS_KEY_ID', passwordVariable: 'AWS_SECRET_ACCESS_KEY')]) {
                sh "export AWS_REGION=${env.AWS_REGION} && aws cloudformation delete-stack --stack-name ${env.CFN_STACK_NAME}"
            }
        }
    }
}
