# Dockerfile for Next.js Frontend
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock* package-lock.json* ./

# Install dependencies
# Force npm install with legacy peer deps to avoid platform-specific dependency issues
RUN rm -f yarn.lock && npm install --legacy-peer-deps

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Set environment variable for port
ENV PORT=3000

# Run in development mode
CMD ["npm", "run", "dev", "--", "-p", "3000"]
