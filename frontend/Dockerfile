# Optimized Dockerfile for low-RAM server: 
# Only serve the pre-built dist folder using Nginx
FROM nginx:alpine

# Copy built files from the local dist/ folder (you must build locally first)
COPY dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port (Nginx default is 80)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
