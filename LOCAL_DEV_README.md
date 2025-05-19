# NightKidz Shop - Local Development Guide

This guide explains how to set up and run the NightKidz Shop locally for development purposes.

## Prerequisites

- Node.js (v22.x)
- npm/pnpm
- Docker and Docker Compose
- PostgreSQL client tools (`psql`, `pg_dump`)
- Git

## Development Environment Scripts

This repository includes several scripts to make local development easier:

### 1. `setup-local-db.js`

This script helps set up your local development database with options to:

- Start with a fresh database (seeded with test data)
- Import production data from Railway

To use it:

```bash
node setup-local-db.js
```

Key features:

- Manages Docker services (PostgreSQL, Redis, MeiliSearch, MinIO)
- Handles database migrations
- Fixes common issues with imported production data
- Fixes region ID problems that often occur between environments

### 2. `restart-dev.sh`

This script provides a quick way to restart your development environment and fix common issues:

```bash
./restart-dev.sh [options]
```

Options:

- `--fix-regions`: Fix region ID issues in the database
- `--fix-schema`: Fix database schema issues
- `--migrate`: Run database migrations
- `--help`: Show help message

### 3. `fix-regions.js`

A standalone script to fix region ID issues:

```bash
node fix-regions.js
```

This is useful when you encounter "Region not found" errors in the storefront.

## Setting Up From Scratch

Follow these steps to set up a development environment from scratch:

1. Clone the repository

   ```bash
   git clone https://github.com/chachacha220510/ProjectNightKidzShop.git
   cd ProjectNightKidzShop
   ```

2. Run the setup script

   ```bash
   node setup-local-db.js
   ```

   Follow the prompts to either:

   - Start with a fresh local database, or
   - Import data from your production database

3. Start the development servers

   ```bash
   # In one terminal
   cd backend
   npm run dev

   # In another terminal
   cd storefront
   npm run dev
   ```

4. Access the services
   - Storefront: http://localhost:8000
   - Admin Panel: http://localhost:9000/app
   - MeiliSearch: http://localhost:7700
   - MinIO Console: http://localhost:9001 (login: minio / minio123)

## Common Issues and Solutions

### Region ID Issues

If you encounter "Region not found" errors after importing production data:

1. Run the fix-regions script:

   ```bash
   ./restart-dev.sh --fix-regions
   ```

2. Clear your browser caches:
   - Open developer tools (F12)
   - Go to Application > Storage > Local Storage
   - Clear storage for localhost:8000
   - Also clear Session Storage if available

### Database Schema Issues

If you encounter database schema-related errors:

1. Run the schema fix:

   ```bash
   ./restart-dev.sh --fix-schema
   ```

2. If that doesn't work, try running migrations:
   ```bash
   ./restart-dev.sh --migrate
   ```

### Docker-Related Issues

If Docker containers aren't running correctly:

1. Check Docker status:

   ```bash
   docker ps
   ```

2. Restart the Docker services:

   ```bash
   docker compose down
   docker compose up -d
   ```

3. Check container logs:
   ```bash
   docker compose logs postgres
   docker compose logs redis
   ```

## Separation Between Local Development and Deployment

The local development tools in this repository (setup-local-db.js, restart-dev.sh, etc.) are designed to run **only in local development environments**. They include safety checks to prevent running in production.

The deployment configuration for Railway is kept separate and uses Railway's built-in mechanisms for deployment.

## Database Backup and Restore

To manually backup your local database:

```bash
pg_dump "postgres://postgres:postgres@localhost:5433/medusa_local" > backup.sql
```

To restore from a backup:

```bash
psql "postgres://postgres:postgres@localhost:5433/medusa_local" < backup.sql
```

## Additional Resources

- [Medusa Documentation](https://docs.medusajs.com/)
- [Next.js Documentation](https://nextjs.org/docs)
