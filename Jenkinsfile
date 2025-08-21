
try {
                            sh '''
                                ssh -o StrictHostKeyChecking=no -o ConnectTimeout=20 -i $KEY_FILE ${EC2_USER}@${env.EC2_HOST} "echo 'SSH connection successful'"

                                ssh -o StrictHostKeyChecking=no -i $KEY_FILE ${EC2_USER}@${env.EC2_HOST} "
                                    set -e
                                    
                                    echo '📁 Creating application directory if it does not exist...'
                                    if [ ! -d /home/${EC2_USER}/oms ]; then
                                        echo \"Creating directory /home/${EC2_USER}/oms\"
                                        mkdir -p /home/${EC2_USER}/oms
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

                                    echo '🚀 Starting all services (infra and app)....'
                                    docker-compose -f docker-compose.infra.slim.yml -f docker-compose.app.slim.yml up -d --remove-orphans

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

