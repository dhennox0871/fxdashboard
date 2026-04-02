# Stage 1: Build React Dashboard
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependencies and install
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Serve using Nginx
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port (Nginx default is 80)
EXPOSE 80

# For local testing if needed, we map port 5173 to 80 in docker-compose.yml
CMD ["nginx", "-g", "daemon off;"]
