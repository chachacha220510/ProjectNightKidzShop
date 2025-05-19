# Deploying to Railway

This guide covers how to deploy this Medusa 2.0 backend to Railway properly.

## Required Environment Variables

The following environment variables **MUST** be set in Railway's environment panel:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT token generation
- `COOKIE_SECRET`: Secret for cookie signing

If these are missing, the application will fail to start with errors like:

```
Error: Environment variable for DATABASE_URL is not set
```

## Railway Configuration

The project includes a `railway.json` file that configures:

- Build command: `pnpm install && pnpm build`
- Start command: `pnpm deploy`

## Important: Migrations

Medusa 2.0 uses a different database migration command format than previous versions:

- **Old format** (Medusa 1.x): `medusa migrations run`
- **New format** (Medusa 2.0): `medusa db:migrate`

The pre-deploy script (in src/scripts/pre-deploy.js) handles this automatically by running:

```javascript
execSync("npx medusa db:migrate", {
  stdio: "inherit",
  env: process.env,
});
```

## Deployment Process

The deployment follows these steps:

1. Railway runs the build command: `pnpm install && pnpm build`
2. Railway runs the start command: `pnpm deploy`
3. The `deploy` script in package.json runs: `npm run predeploy && npm run start`
4. The `predeploy` script runs database migrations with `npx medusa db:migrate`
5. The `start` script initializes the backend and starts the Medusa server

## Troubleshooting

- **"Unknown arguments: migrations, run"**: This happens when using the old Medusa 1.x migration command. Make sure you're using `db:migrate` instead.
- **Database connection errors**: Verify the `DATABASE_URL` is correct and the database is accessible from Railway.
- **Missing environment variables**: Add all required variables in Railway's environment panel.

## Important Note

Do not change the `startCommand` in railway.json from `pnpm deploy` to `pnpm start` as this will skip the necessary migration step, causing deployment failures.
