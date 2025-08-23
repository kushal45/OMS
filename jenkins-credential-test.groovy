pipeline {
    agent any
    
    stages {
        stage('Test Docker Hub Credentials') {
            steps {
                script {
                    echo "🔍 Testing credential availability..."
                    
                    // Test if credential exists and is accessible
                    try {
                        withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                            echo "✅ Credential 'dockerhub' found and accessible"
                            echo "Username: ${DOCKER_USER}"
                            echo "Password length: ${DOCKER_PASS.length()}"
                        }
                    } catch (Exception e) {
                        error "❌ Credential 'dockerhub' not found or not accessible: ${e.getMessage()}"
                    }
                    
                    // Test Docker registry authentication
                    try {
                        withDockerRegistry([credentialsId: 'dockerhub', url: 'https://index.docker.io/v1/']) {
                            sh '''
                                echo "✅ Docker registry authentication successful"
                                echo "Testing docker info..."
                                docker info | head -5
                            '''
                        }
                    } catch (Exception e) {
                        error "❌ Docker registry authentication failed: ${e.getMessage()}"
                    }
                }
            }
        }
    }
}
