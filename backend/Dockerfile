FROM node:22-alpine

WORKDIR /app

# Install PNPM
RUN npm install -g pnpm@9.10.0

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install

# Copy source files
COPY . .

# Build the application
RUN pnpm build

# Set Node environment to production
ENV NODE_ENV=production

# Migrate the database before starting
RUN pnpm predeploy || echo "Database migrations will run at startup"

# Start the application
CMD ["pnpm", "deploy"] 