#!/usr/bin/env node

/**
 * One-command script to pull remote database, run migrations, and fix region references
 * for NightKidz Shop development environment
 */

const { execSync } = require("child_process");
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
  console.log(`${BLUE}===== NightKidz Shop Remote DB Pull Tool =====${RESET}`);
  console.log(
    `${CYAN}This script will import production data, run migrations, and fix region references.${RESET}\n`
  );

  try {
    // Step 1: Get Railway Database URL
    console.log(`${YELLOW}Step 1: Fetching Railway Database URL${RESET}`);

    let railwayDatabaseUrl = process.env.RAILWAY_DB_URL;

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

    // Step 2: Download production database dump
    console.log(`\n${YELLOW}Step 2: Downloading production database${RESET}`);
    try {
      console.log(
        `${CYAN}Creating database dump (this may take a minute)...${RESET}`
      );
      execSync(`pg_dump "${railwayDatabaseUrl}" > "${dumpFilePath}"`, {
        stdio: "inherit",
      });
      console.log(`${GREEN}✓ Database dump created at ${dumpFilePath}${RESET}`);
    } catch (error) {
      console.error(
        `${RED}✗ Error creating database dump: ${error.message}${RESET}`
      );
      process.exit(1);
    }

    // Step 3: Import database dump to local Postgres
    console.log(`\n${YELLOW}Step 3: Importing to local database${RESET}`);

    const localDbHost = process.env.DB_HOST || DEFAULT_LOCAL_DB_HOST;
    const localDbPort = process.env.DB_PORT || DEFAULT_LOCAL_DB_PORT;
    const localDbName = process.env.DB_NAME || DEFAULT_LOCAL_DB;
    const localDbUser = process.env.DB_USER || DEFAULT_LOCAL_DB_USER;
    const localDbPassword =
      process.env.DB_PASSWORD || DEFAULT_LOCAL_DB_PASSWORD;

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

    // Step 4: Run database migrations (ALWAYS REQUIRED)
    await runDatabaseMigrations();

    // Step 5: Fix region references (ALWAYS REQUIRED)
    await fixRegionReferences();

    console.log(
      `\n${GREEN}===== Database update completed successfully! =====${RESET}`
    );
    console.log(
      `${GREEN}✓ Your local database is now in sync with production${RESET}`
    );
    console.log(`${CYAN}You can now run your development servers:${RESET}`);
    console.log(`${CYAN}- Backend: cd backend && npm run dev${RESET}`);
    console.log(`${CYAN}- Frontend: cd storefront && npm run dev${RESET}`);
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
    const backendDir = path.join(process.cwd(), "backend");
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
    console.log(`${CYAN}Found valid region ID: ${regionId}${RESET}`);

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

    if (problematicRegionIds.length === 0) {
      console.log(`${GREEN}✓ No problematic region IDs found${RESET}`);
      await pool.end();
      return;
    }

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
      "pricing",
    ];

    for (const table of tables) {
      try {
        for (const problematicId of problematicRegionIds) {
          await pool.query(
            `UPDATE ${table} SET region_id = $1 WHERE region_id = $2`,
            [regionId, problematicId]
          );
        }
        console.log(
          `${GREEN}✓ Fixed region references in ${table} table${RESET}`
        );
      } catch (err) {
        // Skip tables that don't have region_id column
        console.log(
          `${YELLOW}Skipped ${table} table (no region_id column)${RESET}`
        );
      }
    }

    await pool.end();
    console.log(`${GREEN}✓ All region references fixed${RESET}`);
  } catch (error) {
    console.error(
      `${RED}Failed to fix region references: ${error.message}${RESET}`
    );
    throw error;
  }
}

// Run the main function
main();
