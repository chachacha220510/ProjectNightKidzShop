FROM node:22-alpine AS base

# Install pnpm
RUN npm install -g pnpm@9.10.0

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies without frozen lockfile to prevent errors
RUN pnpm install --no-frozen-lockfile

# Copy the rest of the application
COPY . .

# Build the application
RUN pnpm build

# Expose the port
EXPOSE 9000

# Start the application
CMD ["pnpm", "start"] 