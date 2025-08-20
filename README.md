# OMS - Order Management System

This document provides a comprehensive guide to deploying the Order Management System (OMS) application to an AWS EC2 free tier instance using Jenkins for continuous integration and deployment.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Local Development Setup](#local-development-setup)
- [Deployment to AWS EC2](#deployment-to-aws-ec2)
  - [Step 1: Set up the EC2 Instance](#step-1-set-up-the-ec2-instance)
  - [Step 2: Set up Jenkins](#step-2-set-up-jenkins)
  - [Step 3: Create and Run the Jenkins Pipeline](#step-3-create-and-run-the-jenkins-pipeline)
- [Accessing the Application](#accessing-the-application)

## Prerequisites

Before you begin, ensure you have the following installed on your local machine:

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- [Git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
- An account on [Docker Hub](https://hub.docker.com/)
- An [AWS account](https://aws.amazon.com/free/)

## Project Structure

The OMS application is a microservices-based system built with NestJS. The project is organized as a monorepo with the following structure:

```
/Users/kushalbhattacharya/Documents/PersonalProjects/OMS/
├───apps/
│   ├───api-gateway/
│   ├───auth/
│   ├───cart/
│   ├───inventory/
│   ├───order/
│   └───product/
├───libs/
├───Dockerfile
├───docker-compose.app.slim.yml
├───docker-compose.infra.slim.yml
├───Jenkinsfile
└───deploy.sh
```

## Local Development Setup

To run the application locally for development purposes, follow these steps:

1.  **Clone the repository:**

    ```bash
    git clone <your-repository-url>
    cd OMS
    ```

2.  **Start the infrastructure services:**

    ```bash
    docker-compose -f docker-compose.infra.slim.yml up -d
    ```

3.  **Build and start the application services:**

    ```bash
    docker-compose -f docker-compose.app.slim.yml build
    docker-compose -f docker-compose.app.slim.yml up -d
    ```

## Deployment to AWS EC2

This section describes how to set up a CI/CD pipeline with Jenkins to automatically deploy the application to an AWS EC2 free tier instance.

### Step 1: Set up the EC2 Instance

1.  **Launch a Free Tier EC2 Instance:**
    *   Go to the AWS EC2 console and launch a new instance.
    *   Select the **Amazon Linux 2 AMI** (free tier eligible).
    *   Choose the **t2.micro** instance type (free tier eligible).
    *   **Security Group:** Create a new security group and add rules to allow incoming traffic on:
        *   **SSH (port 22):** From your IP address for secure access.
        *   **Custom TCP (ports 3000-3005):** From anywhere (0.0.0.0/0), so your services can be reached.
    *   **Key Pair:** Create a new key pair and download the `.pem` file. You will need this to SSH into your instance.

2.  **Connect to Your EC2 Instance:**

    ```bash
    ssh -i /path/to/your-key.pem ec2-user@your-ec2-instance-ip
    ```

3.  **Install Docker and Docker Compose:**

    ```bash
    sudo yum update -y
    sudo amazon-linux-extras install docker
    sudo service docker start
    sudo usermod -a -G docker ec2-user
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    ```

    **Important:** Log out and log back in to apply the user group changes.

4.  **Clone Your Project:**

    ```bash
    git clone <your-git-repository-url> /home/ec2-user/oms
    ```

### Step 2: Set up Jenkins

1.  **Run Jenkins in a Docker Container (on your local machine):**

    ```bash
    docker run -d -p 8080:8080 -p 50000:50000 --name jenkins -v jenkins_home:/var/jenkins_home jenkins/jenkins:lts-jdk11
    ```

2.  **Initial Jenkins Setup:**
    *   Open your browser to `http://localhost:8080`.
    *   Get the initial admin password:

        ```bash
        docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
        ```

    *   Follow the on-screen instructions to install the recommended plugins and create an admin user.

3.  **Install Necessary Jenkins Plugins:**
    *   Go to **Manage Jenkins > Manage Plugins**.
    *   Install: `Docker Pipeline` and `SSH Agent`.

4.  **Configure Jenkins Credentials:**
    *   Go to **Manage Jenkins > Manage Credentials**.
    *   Add the following credentials:
        *   **Docker Hub:**
            *   **Kind:** Username with password
            *   **ID:** `dockerhub`
            *   **Username:** Your Docker Hub username
            *   **Password:** Your Docker Hub password or an access token.
        *   **EC2 SSH Key:**
            *   **Kind:** SSH Username with private key
            *   **ID:** `ec2-ssh-key`
            *   **Username:** `ec2-user`
            *   **Private Key:** Check the "Enter directly" option and paste the entire content of your `.pem` file.

### Step 3: Create and Run the Jenkins Pipeline

1.  **Create the Pipeline Job:**
    *   In Jenkins, click **New Item**.
    *   Enter a name (e.g., `oms-deploy`), select **Pipeline**, and click **OK**.
    *   Under the **Pipeline** section, select **Pipeline script from SCM**.
    *   **SCM:** Git
    *   **Repository URL:** Your Git repository URL.
    *   **Script Path:** `Jenkinsfile`

2.  **Run the Build:**
    *   Click **Build Now**. Jenkins will now:
        1.  Check out your code from Git.
        2.  Build your Docker image using the `Dockerfile`.
        3.  Push the image to your Docker Hub repository.
        4.  SSH into your EC2 instance and run the `deploy.sh` script, which will pull the new image and restart your application containers.

## Accessing the Application

After the pipeline finishes successfully, your application will be running on your AWS EC2 instance. You can access the API gateway at `http://your-ec2-instance-ip:3000`.