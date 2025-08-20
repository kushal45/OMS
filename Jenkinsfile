
pipeline {
    agent any

    environment {
        DOCKERHUB_CREDENTIALS = credentials('dockerhub')
        EC2_SSH_CREDENTIALS = credentials('ec2-ssh-key')
        DOCKER_IMAGE_NAME = "your-dockerhub-username/oms-app"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    docker.withRegistry('https://registry.hub.docker.com', DOCKERHUB_CREDENTIALS) {
                        def customImage = docker.build(DOCKER_IMAGE_NAME, "-f Dockerfile .")
                        customImage.push("latest")
                    }
                }
            }
        }

        stage('Deploy to EC2') {
            steps {
                withCredentials([sshUserPrivateKey(credentialsId: 'ec2-ssh-key', keyFileVariable: 'KEY_FILE', usernameVariable: 'USER')]) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no -i $KEY_FILE ${USER}@your-ec2-instance-ip '
                            cd /home/ubuntu/oms &&
                            export DOCKER_IMAGE_NAME=${DOCKER_IMAGE_NAME} &&
                            docker-compose -f docker-compose.app.slim.yml pull &&
                            docker-compose -f docker-compose.app.slim.yml up -d --remove-orphans
                        '
                    '''
                }
            }
        }
    }
}
