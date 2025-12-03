# syntax=docker/dockerfile:1

ARG NODE_VERSION="22"
ARG NODE_DISTRO="-alpine"
ARG NODE_HASH=""
ARG NGINX_VERSION="1.29"
ARG NGINX_DISTRO="-alpine"
ARG NGINX_HASH=""

# Build stage
FROM node:${NODE_VERSION}${NODE_DISTRO}${NODE_HASH} AS builder

WORKDIR /orquestulator

# Copy package files
COPY package*.json ./

# Install dependencies (use install instead of ci to handle lock file sync issues)
RUN npm install

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:${NGINX_VERSION}${NGINX_DISTRO}${NGINX_HASH}

# Copy built files from builder stage
COPY --from=builder /orquestulator/dist /usr/share/nginx/html

# Copy nginx configuration optimized for Docker deployment
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
