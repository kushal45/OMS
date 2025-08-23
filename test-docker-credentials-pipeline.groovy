pipeline {
    agent any
    
    stages {
        stage('Test Docker Hub Credentials') {
            steps {
                script {
                    try {
                        echo "🔍 Testing Docker Hub credentials with ID 'dockerhub'..."
                        
                        withDockerRegistry([credentialsId: 'dockerhub', url: 'https://index.docker.io/v1/']) {
                            sh '''
                                echo "✅ Docker Hub credentials loaded successfully!"
                                echo "Current user: $(whoami)"
                                echo "Docker version: $(docker --version)"
                                
                                # Test docker info
                                echo "Testing docker info..."
                                docker info | head -5
                                
                                echo "✅ All Docker credential tests passed!"
                                echo "🎉 Your credentials are working correctly!"
                            '''
                        }
                    } catch (Exception e) {
                        error "❌ Docker credential test failed: ${e.getMessage()}"
                    }
                }
            }
        }
    }
}
