FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Build the React application
RUN npm run build

# Expose the application port
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
