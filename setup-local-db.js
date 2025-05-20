#!/usr/bin/env node

/**
 * Script to import production data into local development database,
 * fix region ID references, and start development servers.
 */

const { execSync, spawn } = require("child_process");
const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// Configuration
const DEFAULT_BACKUP_NAME = "prod_dump.sql";
const DEFAULT_LOCAL_DB = "medusa_local";
const DEFAULT_LOCAL_DB_USER = "postgres";
const DEFAULT_LOCAL_DB_PASSWORD = "postgres";
const DEFAULT_LOCAL_DB_HOST = "localhost";
const DEFAULT_LOCAL_DB_PORT = "5433";

// ANSI color codes
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";

// Create tmp directory if it doesn't exist
const tmpDir = path.join(process.cwd(), "tmp");
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir);
}

const dumpFilePath = path.join(tmpDir, DEFAULT_BACKUP_NAME);

// Parse command line arguments
const args = process.argv.slice(2);
const downloadOnly = args.includes("--download-only");
const fixRegionsOnly = args.includes("--fix-regions-only");
const skipDownload = args.includes("--skip-download");
const skipImport = args.includes("--skip-import") || downloadOnly;
const skipFixes = args.includes("--skip-fixes");
const skipMigrations = args.includes("--skip-migrations");
const noStart = args.includes("--no-start");

// Create a readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function main() {
  console.log(`${BLUE}===== NightKidz Shop Database Setup Tool =====${RESET}`);
  console.log(
    `${CYAN}This script will import production data, run migrations, fix region references, and start development servers.${RESET}\n`
  );

  try {
    let railwayDatabaseUrl;

    if (!skipDownload && !fixRegionsOnly) {
      console.log(`${YELLOW}Step 1: Fetching Railway Database URL${RESET}`);
      try {
        // Try to get Railway database URL from environment
        railwayDatabaseUrl = process.env.RAILWAY_DB_URL;

        // If not set in environment, prompt the user
        if (!railwayDatabaseUrl) {
          console.log(
            `${CYAN}Please enter your Railway PostgreSQL database URL.${RESET}`
          );
          console.log(
            `${CYAN}You can find this in the Railway dashboard under the Postgres service > Variables > DATABASE_URL${RESET}`
          );
          railwayDatabaseUrl = await askQuestion("Railway Database URL: ");

          if (!railwayDatabaseUrl) {
            throw new Error("No Railway database URL provided.");
          }
        }

        console.log(`${GREEN}✓ Railway database URL obtained${RESET}`);
      } catch (error) {
        console.error(
          `${RED}✗ Error getting Railway database URL: ${error.message}${RESET}`
        );
        process.exit(1);
      }

      // Download production database dump
      console.log(`\n${YELLOW}Step 2: Downloading production database${RESET}`);
      try {
        console.log(
          `${CYAN}Creating database dump (this may take a minute)...${RESET}`
        );
        execSync(`pg_dump "${railwayDatabaseUrl}" > "${dumpFilePath}"`, {
          stdio: "inherit",
        });
        console.log(
          `${GREEN}✓ Database dump created at ${dumpFilePath}${RESET}`
        );
      } catch (error) {
        console.error(
          `${RED}✗ Error creating database dump: ${error.message}${RESET}`
        );
        if (downloadOnly) {
          process.exit(1);
        } else {
          console.log(
            `${YELLOW}Continuing with existing dump file if available...${RESET}`
          );
        }
      }

      if (downloadOnly) {
        console.log(
          `${GREEN}Database dump downloaded successfully. Import skipped due to --download-only flag.${RESET}`
        );
        rl.close();
        return;
      }
    }

    if (fixRegionsOnly) {
      await fixRegionReferences();
      rl.close();
      return;
    }

    if (!skipImport) {
      // Import database dump to local Postgres
      console.log(`\n${YELLOW}Step 3: Importing to local database${RESET}`);

      // Get local database connection info
      const localDbHost = process.env.DB_HOST || DEFAULT_LOCAL_DB_HOST;
      const localDbPort = process.env.DB_PORT || DEFAULT_LOCAL_DB_PORT;
      const localDbName = process.env.DB_NAME || DEFAULT_LOCAL_DB;
      const localDbUser = process.env.DB_USER || DEFAULT_LOCAL_DB_USER;
      const localDbPassword =
        process.env.DB_PASSWORD || DEFAULT_LOCAL_DB_PASSWORD;

      // Confirm with user
      console.log(`${CYAN}Local database connection:${RESET}`);
      console.log(`  Host: ${localDbHost}`);
      console.log(`  Port: ${localDbPort}`);
      console.log(`  Database: ${localDbName}`);
      console.log(`  User: ${localDbUser}`);

      const confirmImport = await askQuestion(
        `${YELLOW}Continue with import? This will overwrite your local database! (y/n): ${RESET}`
      );
      if (confirmImport.toLowerCase() !== "y") {
        console.log(`${YELLOW}Import cancelled by user.${RESET}`);
        rl.close();
        return;
      }

      try {
        // Drop and recreate the database
        console.log(
          `${CYAN}Dropping and recreating database ${localDbName}...${RESET}`
        );
        execSync(
          `PGPASSWORD=${localDbPassword} dropdb -h ${localDbHost} -p ${localDbPort} -U ${localDbUser} --if-exists ${localDbName}`,
          { stdio: "inherit" }
        );
        execSync(
          `PGPASSWORD=${localDbPassword} createdb -h ${localDbHost} -p ${localDbPort} -U ${localDbUser} ${localDbName}`,
          { stdio: "inherit" }
        );

        // Import the dump
        console.log(`${CYAN}Importing database dump...${RESET}`);
        execSync(
          `PGPASSWORD=${localDbPassword} psql -h ${localDbHost} -p ${localDbPort} -U ${localDbUser} -d ${localDbName} < "${dumpFilePath}"`,
          { stdio: "inherit" }
        );
        console.log(`${GREEN}✓ Database imported successfully${RESET}`);
      } catch (error) {
        console.error(
          `${RED}✗ Error importing database: ${error.message}${RESET}`
        );
        rl.close();
        return;
      }
    }

    // Run database migrations
    if (!skipMigrations) {
      await runDatabaseMigrations();
    }

    // Fix region references - always run this after import
    if (!skipFixes) {
      await fixRegionReferences();
    }

    console.log(
      `\n${GREEN}===== Database setup completed successfully! =====${RESET}`
    );

    if (!noStart) {
      await startDevelopmentServers();
    } else {
      console.log(
        `${CYAN}You can now run your Medusa server with local data.${RESET}`
      );
      console.log(
        `${YELLOW}Note: If you encounter region-related errors, run this script with --fix-regions-only flag.${RESET}`
      );
    }
  } catch (error) {
    console.error(
      `${RED}An unexpected error occurred: ${error.message}${RESET}`
    );
  } finally {
    rl.close();
  }
}

async function runDatabaseMigrations() {
  console.log(`\n${YELLOW}Step 4: Running database migrations${RESET}`);

  try {
    console.log(`${CYAN}Executing Medusa database migrations...${RESET}`);

    // Get backend directory path
    const backendDir = path.join(process.cwd(), "backend");

    // Run Medusa migrations
    execSync(`cd ${backendDir} && npx medusa db:migrate`, {
      stdio: "inherit",
    });

    console.log(`${GREEN}✓ Database migrations completed successfully${RESET}`);
  } catch (error) {
    console.error(
      `${RED}✗ Error running database migrations: ${error.message}${RESET}`
    );
    throw error;
  }
}

async function fixRegionReferences() {
  console.log(`\n${YELLOW}Step 5: Fixing region references${RESET}`);

  const localDbHost = process.env.DB_HOST || DEFAULT_LOCAL_DB_HOST;
  const localDbPort = process.env.DB_PORT || DEFAULT_LOCAL_DB_PORT;
  const localDbName = process.env.DB_NAME || DEFAULT_LOCAL_DB;
  const localDbUser = process.env.DB_USER || DEFAULT_LOCAL_DB_USER;
  const localDbPassword = process.env.DB_PASSWORD || DEFAULT_LOCAL_DB_PASSWORD;

  try {
    // Create a connection pool to the local database
    const pool = new Pool({
      host: localDbHost,
      port: localDbPort,
      database: localDbName,
      user: localDbUser,
      password: localDbPassword,
    });

    // Get all available region IDs
    const regionResult = await pool.query(
      "SELECT id FROM region WHERE deleted_at IS NULL LIMIT 1"
    );

    if (regionResult.rows.length === 0) {
      console.error(
        `${RED}✗ No available regions found in the database${RESET}`
      );
      await pool.end();
      return;
    }

    const regionId = regionResult.rows[0].id;
    console.log(`${CYAN}Found replacement region ID: ${regionId}${RESET}`);

    // Get all problematic region IDs to replace them
    const problematicRegionsQuery = await pool.query(
      "SELECT DISTINCT region_id FROM cart WHERE region_id NOT IN (SELECT id FROM region WHERE deleted_at IS NULL) AND region_id IS NOT NULL"
    );

    // Add hardcoded known problematic ID
    const problematicRegionIds = ["reg_01JVK89Q8PEA1EMJS7FPBN12VF"];

    // Add any additional problematic IDs found
    problematicRegionsQuery.rows.forEach((row) => {
      if (!problematicRegionIds.includes(row.region_id)) {
        problematicRegionIds.push(row.region_id);
      }
    });

    console.log(
      `${CYAN}Found ${problematicRegionIds.length} problematic region IDs to fix${RESET}`
    );

    // Update all tables that might contain region references
    const tables = [
      "cart",
      "customer",
      "payment_session",
      "shipping_option",
      "shipping_method",
      "discount",
      "payment_collection",
      "pricing", // Added pricing table which may contain region references
    ];

    for (const table of tables) {
      try {
        for (const problematicId of problematicRegionIds) {
          console.log(
            `${CYAN}Updating region references in ${table} table...${RESET}`
          );
          await pool.query(
            `UPDATE ${table} SET region_id = $1 WHERE region_id = $2`,
            [regionId, problematicId]
          );
        }
      } catch (err) {
        // Skip tables that don't have region_id column
        console.log(
          `${YELLOW}Skipping table ${table} (might not have region_id column)${RESET}`
        );
      }
    }

    console.log(`${GREEN}✓ Region references fixed successfully${RESET}`);
    await pool.end();
  } catch (error) {
    console.error(
      `${RED}✗ Error fixing region references: ${error.message}${RESET}`
    );
  }
}

async function startDevelopmentServers() {
  console.log(`\n${YELLOW}Step 6: Starting development servers${RESET}`);

  const startServers = await askQuestion(
    `${YELLOW}Do you want to start the development servers now? (y/n): ${RESET}`
  );

  if (startServers.toLowerCase() !== "y") {
    console.log(`${YELLOW}Server startup skipped.${RESET}`);
    console.log(
      `${CYAN}You can manually start the backend with: cd backend && npm run dev${RESET}`
    );
    console.log(
      `${CYAN}You can manually start the frontend with: cd storefront && npm run dev${RESET}`
    );
    return;
  }

  console.log(`${CYAN}Starting backend server...${RESET}`);
  console.log(
    `${CYAN}To view the backend server, navigate to: http://localhost:9000/app${RESET}`
  );
  console.log(`${CYAN}To stop the servers, press Ctrl+C twice${RESET}`);

  // Start backend in a new terminal
  const backendProcess = spawn("osascript", [
    "-e",
    'tell application "Terminal" to do script "cd ' +
      path.join(process.cwd(), "backend") +
      ' && npm run dev"',
  ]);

  backendProcess.on("error", (error) => {
    console.error(`${RED}Failed to start backend: ${error.message}${RESET}`);
  });

  // Give some time for backend to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log(`${CYAN}Starting frontend server...${RESET}`);
  console.log(
    `${CYAN}To view the frontend server, navigate to: http://localhost:8000${RESET}`
  );

  // Start frontend in a new terminal
  const frontendProcess = spawn("osascript", [
    "-e",
    'tell application "Terminal" to do script "cd ' +
      path.join(process.cwd(), "storefront") +
      ' && npm run dev"',
  ]);

  frontendProcess.on("error", (error) => {
    console.error(`${RED}Failed to start frontend: ${error.message}${RESET}`);
  });

  console.log(
    `${GREEN}✓ Development servers started in separate terminal windows${RESET}`
  );
}

// Run the main function
main().catch((error) => {
  console.error(`${RED}Fatal error: ${error.message}${RESET}`);
  process.exit(1);
});
