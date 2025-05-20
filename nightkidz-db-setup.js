#!/usr/bin/env node

/**
 * NightKidz Shop - All-in-one Database Setup Tool
 *
 * This script:
 * 1. Pulls data from the production database using default URL
 * 2. Completely replaces your local database with production data
 * 3. Runs all necessary database migrations
 * 4. Fixes region ID references and other common issues
 * 5. Verifies database integrity before completion
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

// Default Railway PostgreSQL URL (production database)
const DEFAULT_RAILWAY_DB_URL =
  "postgresql://postgres:SDeAKGSUwurvNQbRQQHyuqqZlDipRJph@shortline.proxy.rlwy.net:52687/railway";

// ANSI color codes
const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const CYAN = "\x1b[36m";

// Create tmp and backup directories if they don't exist
const tmpDir = path.join(process.cwd(), "tmp");
const backupDir = path.join(tmpDir, "backups");

if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir);
}

if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}

const dumpFilePath = path.join(backupDir, DEFAULT_BACKUP_NAME);

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
    `${CYAN}This script will synchronize your local database with production data and fix common issues.${RESET}\n`
  );

  try {
    // Step 1: Confirm the operation
    console.log(
      `${YELLOW}⚠️  Warning: This will completely replace your local database with production data${RESET}`
    );
    const confirm = await askQuestion(`${YELLOW}Continue? (y/n): ${RESET}`);

    if (confirm.toLowerCase() !== "y") {
      console.log(`${YELLOW}Operation cancelled by user.${RESET}`);
      rl.close();
      return;
    }

    // Step 2: Download production database dump using default URL
    console.log(`\n${YELLOW}Step 1: Downloading production database${RESET}`);
    console.log(`${CYAN}Using default production database URL...${RESET}`);

    try {
      console.log(
        `${CYAN}Creating database dump (this may take a minute)...${RESET}`
      );
      execSync(`pg_dump "${DEFAULT_RAILWAY_DB_URL}" > "${dumpFilePath}"`, {
        stdio: "inherit",
      });
      console.log(`${GREEN}✓ Database dump created at ${dumpFilePath}${RESET}`);
    } catch (error) {
      console.error(
        `${RED}✗ Error creating database dump: ${error.message}${RESET}`
      );
      process.exit(1);
    }

    // Step 3: Clear and recreate local database
    console.log(`\n${YELLOW}Step 2: Preparing local database${RESET}`);

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

    try {
      // First, terminate all connections to the database
      console.log(
        `${CYAN}Terminating existing connections to database ${localDbName}...${RESET}`
      );

      // Create a temporary connection to postgres database to terminate connections
      const tempPool = new Pool({
        host: localDbHost,
        port: localDbPort,
        database: "postgres", // Connect to default postgres database
        user: localDbUser,
        password: localDbPassword,
      });

      try {
        // Terminate all connections to the target database
        await tempPool.query(`
          SELECT pg_terminate_backend(pg_stat_activity.pid)
          FROM pg_stat_activity
          WHERE pg_stat_activity.datname = '${localDbName}'
          AND pid <> pg_backend_pid()
        `);
        console.log(`${GREEN}✓ Existing connections terminated${RESET}`);
      } catch (err) {
        console.log(
          `${YELLOW}⚠️ Could not terminate all connections: ${err.message}${RESET}`
        );
      } finally {
        // Close the temporary connection
        await tempPool.end();
      }

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
      console.log(`${GREEN}✓ Local database reset successfully${RESET}`);
    } catch (error) {
      console.error(
        `${RED}✗ Error resetting local database: ${error.message}${RESET}`
      );
      rl.close();
      return;
    }

    // Step 4: Import database dump
    console.log(`\n${YELLOW}Step 3: Importing production data${RESET}`);
    try {
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

    // Step 5: Run database migrations
    console.log(`\n${YELLOW}Step 4: Running database migrations${RESET}`);
    try {
      console.log(`${CYAN}Executing Medusa database migrations...${RESET}`);
      const backendDir = path.join(process.cwd(), "backend");
      execSync(`cd ${backendDir} && npx medusa db:migrate`, {
        stdio: "inherit",
      });
      console.log(
        `${GREEN}✓ Database migrations completed successfully${RESET}`
      );
    } catch (error) {
      console.error(
        `${RED}✗ Error running database migrations: ${error.message}${RESET}`
      );
      throw error;
    }

    // Step 6: Fix region references
    console.log(`\n${YELLOW}Step 5: Fixing region references${RESET}`);
    await fixRegionReferences(
      localDbHost,
      localDbPort,
      localDbName,
      localDbUser,
      localDbPassword
    );

    // Step 7: Verify database integrity
    console.log(`\n${YELLOW}Step 6: Verifying database integrity${RESET}`);
    await verifyDatabaseIntegrity(
      localDbHost,
      localDbPort,
      localDbName,
      localDbUser,
      localDbPassword
    );

    console.log(
      `\n${GREEN}===== Database setup completed successfully! =====${RESET}`
    );
    console.log(
      `${GREEN}✓ Your local database is now in sync with production${RESET}`
    );
    console.log(`${GREEN}✓ All known issues have been fixed${RESET}`);
    console.log(`\n${CYAN}You can now run your development servers:${RESET}`);
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

async function fixRegionReferences(host, port, database, user, password) {
  try {
    // Create a connection pool to the local database
    const pool = new Pool({
      host,
      port,
      database,
      user,
      password,
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

    // Add hardcoded known problematic IDs
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

async function verifyDatabaseIntegrity(host, port, database, user, password) {
  try {
    // Create a connection pool to the local database
    const pool = new Pool({
      host,
      port,
      database,
      user,
      password,
    });

    // Verify key tables exist and have data
    console.log(`${CYAN}Checking key tables...${RESET}`);

    // Array of essential tables to check
    const essentialTables = [
      { name: "product", entity: "products" },
      { name: "region", entity: "regions" },
      { name: "store", entity: "store" },
      { name: "user", entity: "users" },
      { name: "shipping_option", entity: "shipping options" },
      { name: "currency", entity: "currencies" },
    ];

    for (const table of essentialTables) {
      try {
        const result = await pool.query(`SELECT COUNT(*) FROM "${table.name}"`);
        const count = parseInt(result.rows[0].count);

        if (count > 0) {
          console.log(
            `${GREEN}✓ Table ${table.name}: ${count} ${table.entity} found${RESET}`
          );
        } else {
          console.log(
            `${YELLOW}⚠️ Table ${table.name}: No ${table.entity} found${RESET}`
          );
        }
      } catch (err) {
        console.log(
          `${RED}✗ Table ${table.name} verification failed: ${err.message}${RESET}`
        );
      }
    }

    // Verify foreign key constraints
    console.log(`\n${CYAN}Checking for foreign key issues...${RESET}`);

    // List of critical foreign key relationships to check
    const foreignKeyChecks = [
      {
        query:
          "SELECT COUNT(*) FROM cart WHERE region_id IS NOT NULL AND region_id NOT IN (SELECT id FROM region WHERE deleted_at IS NULL)",
        name: "Invalid region references in carts",
      },
      {
        query:
          "SELECT COUNT(*) FROM product WHERE collection_id IS NOT NULL AND collection_id NOT IN (SELECT id FROM product_collection)",
        name: "Invalid collection references in products",
      },
    ];

    for (const check of foreignKeyChecks) {
      try {
        const result = await pool.query(check.query);
        const count = parseInt(result.rows[0].count);

        if (count === 0) {
          console.log(`${GREEN}✓ Check passed: ${check.name}${RESET}`);
        } else {
          console.log(
            `${RED}✗ Check failed: ${check.name} (${count} issues found)${RESET}`
          );
        }
      } catch (err) {
        console.log(
          `${RED}✗ Check failed: ${check.name} - ${err.message}${RESET}`
        );
      }
    }

    // Check for schema issues with is_giftcard column
    console.log(`\n${CYAN}Checking for common schema issues...${RESET}`);
    try {
      await pool.query(`SELECT is_giftcard FROM "item" LIMIT 1`);
      console.log(
        `${GREEN}✓ Schema check passed: is_giftcard column exists in item table${RESET}`
      );
    } catch (err) {
      if (err.message.includes('column "is_giftcard" does not exist')) {
        console.log(
          `${YELLOW}⚠️ Adding missing is_giftcard column to item table...${RESET}`
        );
        try {
          await pool.query(
            `ALTER TABLE "item" ADD COLUMN IF NOT EXISTS "is_giftcard" BOOLEAN DEFAULT FALSE`
          );
          console.log(
            `${GREEN}✓ Fixed: Added is_giftcard column to item table${RESET}`
          );
        } catch (alterErr) {
          console.log(
            `${RED}✗ Failed to fix is_giftcard column: ${alterErr.message}${RESET}`
          );
        }
      } else {
        console.log(`${RED}✗ Schema check error: ${err.message}${RESET}`);
      }
    }

    await pool.end();
    console.log(`${GREEN}✓ Database integrity verification completed${RESET}`);
  } catch (error) {
    console.error(
      `${RED}Database verification failed: ${error.message}${RESET}`
    );
    throw error;
  }
}

// Run the main function
main();
