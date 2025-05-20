# NightKidz Shop - Local Development Setup

This guide explains how to set up and manage your local development environment for the NightKidz Shop e-commerce application.

## Prerequisites

- Node.js (v22.x)
- npm (v10.x) or pnpm
- PostgreSQL (v15+) running on port 5433
- Docker (optional, for running services in containers)

## Quick Start Guide

### 1. Pull Remote Database & Setup Local Environment

The fastest way to get your local environment ready is to use our one-command database pull tool:

```bash
# Pull the production database, run migrations, and fix region references in one command
./pull-remote-db.js
```

This script will:

- Download the latest production database
- Import it to your local PostgreSQL instance
- Run all necessary database migrations
- Fix any region ID reference issues
- Set up your environment to work with the storefront and admin

Once completed, you can start your development servers.

### 2. Start Development Servers

#### Backend Server

```bash
cd backend
npm run dev
```

Admin panel: http://localhost:9000/app

#### Storefront

```bash
cd storefront
npm run dev
```

Storefront: http://localhost:8000

## Additional Utilities

### Quick Database Update

If you've already pulled the production database but need to run migrations and fix regions:

```bash
# Only run migrations and fix region references (no database pull)
./update-db.js
```

### Region ID Fixer

If you're experiencing region-related errors in your application:

```bash
# Fix region ID references only
./fix-regions.js
```

## Common Issues and Solutions

### Region ID Mismatches

Region ID references can get out of sync between environments. This causes errors like:

- "Invalid region" errors
- Products not showing up in the storefront
- Cart creation failures
- Shipping/payment method errors

**Solution**: Run `./update-db.js` to fix region references.

### Database Schema Issues

If you're seeing errors related to missing columns or tables:

**Solution**: Run `./update-db.js` to apply the latest migrations.

### Working with Docker

If you prefer to use Docker for your PostgreSQL database:

```bash
# Start PostgreSQL container
docker run -d --name medusa-postgres -p 5433:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=medusa_local postgres:15

# Stop PostgreSQL container
docker stop medusa-postgres
```

## Troubleshooting Tips

1. **Clear your browser cache**: Some issues can be resolved by clearing localStorage and sessionStorage.

2. **Restart the development servers**: Sometimes a simple restart fixes issues.

3. **Verify database connection**: Make sure your PostgreSQL server is running on port 5433.

4. **Check logs**: Backend logs often provide hints about what's going wrong.

## Additional Resources

For more information about Medusa.js, refer to the [official documentation](https://docs.medusajs.com/).
