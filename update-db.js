#!/usr/bin/env node

/**
 * Script to update the local Medusa database:
 * 1. Run database migrations
 * 2. Fix region ID references
 *
 * This is a simplified version of setup-local-db.js for quick database updates.
 */

const { execSync } = require("child_process");
const { Pool } = require("pg");
const path = require("path");

// Configuration
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

async function main() {
  console.log(`${BLUE}===== NightKidz Shop Database Update Tool =====${RESET}`);
  console.log(
    `${CYAN}Running migrations and fixing region references...${RESET}\n`
  );

  try {
    // Run database migrations
    await runDatabaseMigrations();

    // Fix region references
    await fixRegionReferences();

    console.log(`\n${GREEN}✓ Database update completed successfully!${RESET}`);
  } catch (error) {
    console.error(`${RED}Error: ${error.message}${RESET}`);
    process.exit(1);
  }
}

async function runDatabaseMigrations() {
  console.log(`${CYAN}Running database migrations...${RESET}`);

  try {
    // Get backend directory path
    const backendDir = path.join(process.cwd(), "backend");

    // Run Medusa migrations
    execSync(`cd ${backendDir} && npx medusa db:migrate`, {
      stdio: "inherit",
    });

    console.log(`${GREEN}✓ Database migrations applied${RESET}`);
  } catch (error) {
    console.error(`${RED}Failed to run migrations: ${error.message}${RESET}`);
    throw error;
  }
}

async function fixRegionReferences() {
  console.log(`\n${CYAN}Fixing region references...${RESET}`);

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
      console.error(`${RED}No available regions found in the database${RESET}`);
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
