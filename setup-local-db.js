#!/usr/bin/env node

/**
 * Script to import production data into local development database
 * and fix region ID references.
 */

const { execSync } = require("child_process");
const { createPool } = require("pg");
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
    `${CYAN}This script will import production data into your local database and fix region references.${RESET}\n`
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

    // Fix region references
    if (!skipFixes) {
      await fixRegionReferences();
    }

    console.log(
      `\n${GREEN}===== Database setup completed successfully! =====${RESET}`
    );
    console.log(
      `${CYAN}You can now run your Medusa server with local data.${RESET}`
    );
    console.log(
      `${YELLOW}Note: If you encounter region-related errors, run this script with --fix-regions-only flag.${RESET}`
    );
  } catch (error) {
    console.error(
      `${RED}An unexpected error occurred: ${error.message}${RESET}`
    );
  } finally {
    rl.close();
  }
}

async function fixRegionReferences() {
  console.log(`\n${YELLOW}Step 4: Fixing region references${RESET}`);

  const localDbHost = process.env.DB_HOST || DEFAULT_LOCAL_DB_HOST;
  const localDbPort = process.env.DB_PORT || DEFAULT_LOCAL_DB_PORT;
  const localDbName = process.env.DB_NAME || DEFAULT_LOCAL_DB;
  const localDbUser = process.env.DB_USER || DEFAULT_LOCAL_DB_USER;
  const localDbPassword = process.env.DB_PASSWORD || DEFAULT_LOCAL_DB_PASSWORD;

  try {
    // Create a connection pool to the local database
    const pool = createPool({
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

    // Update problematic region references
    console.log(`${CYAN}Updating region references in cart table...${RESET}`);
    await pool.query(
      "UPDATE cart SET region_id = $1 WHERE region_id = 'reg_01JVK89Q8PEA1EMJS7FPBN12VF'",
      [regionId]
    );

    console.log(
      `${CYAN}Updating region references in customer table...${RESET}`
    );
    await pool.query(
      "UPDATE customer SET region_id = $1 WHERE region_id = 'reg_01JVK89Q8PEA1EMJS7FPBN12VF'",
      [regionId]
    );

    console.log(
      `${CYAN}Updating region references in payment_session table...${RESET}`
    );
    await pool.query(
      "UPDATE payment_session SET region_id = $1 WHERE region_id = 'reg_01JVK89Q8PEA1EMJS7FPBN12VF'",
      [regionId]
    );

    console.log(`${GREEN}✓ Region references fixed successfully${RESET}`);
    await pool.end();
  } catch (error) {
    console.error(
      `${RED}✗ Error fixing region references: ${error.message}${RESET}`
    );
  }
}

// Run the main function
main().catch((error) => {
  console.error(`${RED}Fatal error: ${error.message}${RESET}`);
  process.exit(1);
});
