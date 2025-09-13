# auth/Dockerfile
FROM node:21-alpine

#install curl
RUN apk add --no-cache curl

WORKDIR /app
COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000