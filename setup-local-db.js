#!/usr/bin/env node

/**
 * Script to set up local development environment for the NightKidz Shop project
 *
 * This script provides options to:
 * 1. Run with local database only (no production data)
 * 2. Pull production data to a local database (requires DB migration tools)
 *
 * Enhanced features:
 * - Comprehensive region ID synchronization
 * - Cache cleanup for frontend and backend
 * - Database schema migration handling
 * - Handles specific RegionID issues (reg_01JVK89Q8PEA1EMJS7FPBN12VF)
 */

// Safety check: Prevent this script from running in production environments
if (process.env.NODE_ENV === "production") {
  console.error(
    "⚠️  This script is intended for local development only and should not run in production."
  );
  process.exit(1);
}

const readline = require("readline");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Define colors for console output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

/**
 * Detect region ID references in the frontend cache and localStorage
 * @returns {Promise<string[]>} Array of region IDs found in the frontend
 */
async function detectFrontendRegionIds() {
  const frontendCachePath = path.join(
    __dirname,
    "storefront",
    ".next",
    "cache"
  );
  const detectedIds = new Set();

  // Skip if no cache directory exists
  if (!fs.existsSync(frontendCachePath)) {
    return [];
  }

  try {
    // Find all JSON files in the cache and look for region IDs
    const findCmd = `find ${frontendCachePath} -type f -name "*.json" -exec grep -l "reg_" {} \\;`;
    const files = execSync(findCmd, { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);

    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      // Find region IDs (format: reg_XXXXXXXXXXXXXXXXXXX)
      const matches = content.match(/reg_[a-zA-Z0-9]{20,}/g);
      if (matches) {
        matches.forEach((id) => detectedIds.add(id));
      }
    }

    // Add known problematic region IDs
    detectedIds.add("reg_01JVK89Q8PEA1EMJS7FPBN12VF");

    return Array.from(detectedIds);
  } catch (error) {
    console.log(
      `${colors.yellow}Warning: Could not scan frontend cache: ${error.message}${colors.reset}`
    );
    return ["reg_01JVK89Q8PEA1EMJS7FPBN12VF"]; // Return the known problematic ID anyway
  }
}

/**
 * Get available regions from the database
 * @param {Client} client - PostgreSQL client
 * @returns {Promise<Array>} - Available regions
 */
async function getAvailableRegions(client) {
  const { rows } = await client.query(
    "SELECT id, name, currency_code FROM region WHERE deleted_at IS NULL"
  );
  return rows;
}

/**
 * Update region references in the database
 * @param {Client} client - PostgreSQL client
 * @param {string} oldRegionId - Old region ID to replace
 * @param {string} newRegionId - New region ID to use
 * @returns {Promise<number>} - Number of affected tables
 */
async function updateRegionReferences(client, oldRegionId, newRegionId) {
  // Tables that might contain region_id references
  const tables = [
    "cart",
    "customer",
    "discount_condition_region",
    "discount_region",
    "order",
    "payment_collection",
    "payment_session",
    "shipping_option",
    "draft_order",
    "batch_job",
    "claim_order",
    "swap",
    "gift_card",
  ];

  let updatedTables = 0;

  for (const table of tables) {
    try {
      // Check if table exists and has region_id column
      const checkTableQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        ) AS "exists"`;

      const {
        rows: [{ exists: tableExists }],
      } = await client.query(checkTableQuery, [table]);

      if (!tableExists) continue;

      const checkColumnQuery = `
        SELECT EXISTS (
          SELECT FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = $1 
          AND column_name = 'region_id'
        ) AS "exists"`;

      const {
        rows: [{ exists: columnExists }],
      } = await client.query(checkColumnQuery, [table]);

      if (!columnExists) continue;

      // Update the region_id in the table
      const { rowCount } = await client.query(
        `UPDATE ${table} SET region_id = $1 WHERE region_id = $2`,
        [newRegionId, oldRegionId]
      );

      if (rowCount > 0) {
        console.log(
          `${colors.green}✓ Updated ${rowCount} records in ${table}${colors.reset}`
        );
        updatedTables++;
      }
    } catch (err) {
      console.log(
        `${colors.yellow}⚠ Error updating ${table}: ${err.message}${colors.reset}`
      );
    }
  }

  return updatedTables;
}

/**
 * Fix the is_giftcard database issue
 * @param {Client} client - PostgreSQL client
 */
async function fixDatabaseSchema(client) {
  console.log(
    `\n${colors.yellow}Checking database schema for common issues...${colors.reset}`
  );

  try {
    // Check if is_giftcard column exists in the item table
    const checkColumnQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'item' 
        AND column_name = 'is_giftcard'
      ) AS "exists"`;

    const {
      rows: [{ exists: columnExists }],
    } = await client.query(checkColumnQuery);

    if (!columnExists) {
      console.log(
        `${colors.yellow}Adding missing is_giftcard column to item table...${colors.reset}`
      );
      await client.query(
        `ALTER TABLE "item" ADD COLUMN IF NOT EXISTS "is_giftcard" BOOLEAN DEFAULT FALSE`
      );
      console.log(`${colors.green}✓ Added is_giftcard column${colors.reset}`);
    } else {
      console.log(`${colors.green}✓ is_giftcard column exists${colors.reset}`);
    }
  } catch (err) {
    console.log(
      `${colors.yellow}⚠ Error checking/fixing schema: ${err.message}${colors.reset}`
    );
  }
}

/**
 * Run Medusa database migrations
 */
function runDatabaseMigrations() {
  console.log(
    `\n${colors.yellow}Running database migrations...${colors.reset}`
  );

  try {
    // Change to backend directory
    process.chdir(path.join(__dirname, "backend"));

    // Run Medusa migrations
    execSync("npx medusa db:migrate", { stdio: "inherit" });

    console.log(
      `${colors.green}✓ Database migrations completed${colors.reset}`
    );
  } catch (err) {
    console.log(
      `${colors.red}Error running migrations: ${err.message}${colors.reset}`
    );
  }
}

/**
 * Clean frontend caches
 */
function cleanFrontendCaches() {
  console.log(`\n${colors.yellow}Cleaning frontend caches...${colors.reset}`);

  const cachePaths = [
    path.join(__dirname, "storefront", ".next", "cache"),
    path.join(__dirname, "storefront", "node_modules", ".cache"),
    path.join(__dirname, "storefront", ".next", "server", ".next-server"),
    path.join(__dirname, "storefront", ".next", "trace"),
  ];

  for (const cachePath of cachePaths) {
    if (fs.existsSync(cachePath)) {
      try {
        execSync(`rm -rf "${cachePath}"`);
        console.log(
          `${colors.green}✓ Cleaned cache in ${cachePath}${colors.reset}`
        );
      } catch (err) {
        console.log(
          `${colors.yellow}⚠ Could not clean cache in ${cachePath}: ${err.message}${colors.reset}`
        );
      }
    }
  }
}

/**
 * Kill any running development processes
 */
function killRunningProcesses() {
  console.log(
    `\n${colors.yellow}Checking for running development processes...${colors.reset}`
  );

  try {
    // Kill Medusa development processes
    execSync("pkill -f 'medusa develop' || true");

    // Kill Next.js development processes
    execSync("pkill -f 'next dev' || true");

    console.log(
      `${colors.green}✓ Any running development processes have been stopped${colors.reset}`
    );
  } catch (err) {
    // Ignore errors, as they likely mean no processes were found
  }
}

/**
 * Generate a region fix script
 */
function generateRegionFixScript(problemRegionIds, availableRegionId) {
  const scriptPath = path.join(__dirname, "fix-regions.js");
  const scriptContent = `
/**
 * Region ID Fix Script
 * 
 * This script fixes region ID references in the database.
 * Run it with: node fix-regions.js
 */

const { Client } = require("pg");

async function main() {
  // Connect to database
  const client = new Client({
    host: "localhost",
    port: 5433,
    user: "postgres",
    password: "postgres",
    database: "medusa_local",
  });

  await client.connect();
  console.log("Connected to database");

  // Problem region IDs that need to be replaced
  const problemRegionIds = ${JSON.stringify(problemRegionIds)};
  
  // Replacement region ID (must exist in your database)
  const replacementRegionId = "${availableRegionId}";

  // Tables that might contain region_id references
  const tables = [
    "cart",
    "customer",
    "discount_condition_region",
    "discount_region",
    "order",
    "payment_collection",
    "payment_session",
    "shipping_option",
    "draft_order",
    "batch_job",
    "claim_order",
    "swap",
    "gift_card",
  ];

  for (const oldRegionId of problemRegionIds) {
    console.log(\`Replacing region ID: \${oldRegionId} with \${replacementRegionId}...\`);
    
    for (const table of tables) {
      try {
        // Check if table exists and has region_id column
        const checkTableQuery = \`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          ) AS "exists"\`;

        const {
          rows: [{ exists: tableExists }],
        } = await client.query(checkTableQuery, [table]);

        if (!tableExists) continue;

        const checkColumnQuery = \`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = $1 
            AND column_name = 'region_id'
          ) AS "exists"\`;

        const {
          rows: [{ exists: columnExists }],
        } = await client.query(checkColumnQuery, [table]);

        if (!columnExists) continue;

        // Update the region_id in the table
        const { rowCount } = await client.query(
          \`UPDATE \${table} SET region_id = $1 WHERE region_id = $2\`,
          [replacementRegionId, oldRegionId]
        );

        if (rowCount > 0) {
          console.log(\`✓ Updated \${rowCount} records in \${table}\`);
        }
      } catch (err) {
        console.log(\`⚠ Error updating \${table}: \${err.message}\`);
      }
    }
  }

  // Close connection
  await client.end();
  console.log("Database connection closed");
  console.log("Region fixes completed");
}

main().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
`;

  fs.writeFileSync(scriptPath, scriptContent);
  console.log(
    `${colors.green}✓ Generated region fix script: ${scriptPath}${colors.reset}`
  );
  console.log(
    `${colors.cyan}You can run this script anytime with: node fix-regions.js${colors.reset}`
  );

  return scriptPath;
}

async function main() {
  console.log(
    `${colors.blue}NightKidz Shop - Local Development Setup${colors.reset}`
  );
  console.log(
    `${colors.cyan}This script will help you set up your local development environment.${colors.reset}\n`
  );

  try {
    // Kill any running development processes first
    killRunningProcesses();

    // Check if Docker is running
    try {
      execSync("docker info", { stdio: "ignore" });
      console.log(`${colors.green}✓ Docker is running${colors.reset}`);
    } catch (err) {
      console.log(
        `${colors.red}✗ Docker is not running. Please start Docker and try again.${colors.reset}`
      );
      process.exit(1);
    }

    // Start Docker Compose services
    console.log(
      `\n${colors.yellow}Starting Docker Compose services...${colors.reset}`
    );
    execSync("docker compose up -d", { stdio: "inherit" });

    // Clean frontend caches before import
    cleanFrontendCaches();

    // Ask if user wants to initialize with production data
    const initWithProductionData = await question(
      `\n${colors.yellow}Do you want to initialize with production data? (yes/no) ${colors.reset}`
    );

    if (initWithProductionData.toLowerCase() === "yes") {
      console.log(
        `\n${colors.yellow}To import production data, you'll need the production DATABASE_URL.${colors.reset}`
      );
      console.log(
        `${colors.yellow}Check the Railway dashboard for the correct connection string.${colors.reset}\n`
      );

      const dbUrl = await question(
        `${colors.cyan}Enter the production DATABASE_URL: ${colors.reset}`
      );

      if (!dbUrl) {
        console.log(
          `${colors.red}No DATABASE_URL provided, skipping production data import.${colors.reset}`
        );
      } else {
        // Always clear the database before importing production data
        console.log(
          `\n${colors.yellow}Clearing local database...${colors.reset}`
        );

        try {
          // First terminate all connections to the database
          console.log(
            `${colors.yellow}Terminating active connections...${colors.reset}`
          );
          execSync(
            `docker exec projectnightkidzshop-postgres-1 psql -U postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = 'medusa_local' AND pid <> pg_backend_pid();"`,
            { stdio: "inherit" }
          );

          // Then drop and recreate the database
          execSync(
            `docker exec projectnightkidzshop-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS medusa_local;"`,
            { stdio: "inherit" }
          );
          execSync(
            `docker exec projectnightkidzshop-postgres-1 psql -U postgres -c "CREATE DATABASE medusa_local;"`,
            { stdio: "inherit" }
          );
          console.log(`${colors.green}✓ Local database cleared${colors.reset}`);
        } catch (err) {
          console.log(
            `${colors.red}Error clearing database: ${err.message}${colors.reset}`
          );
          process.exit(1);
        }

        console.log(
          `\n${colors.yellow}This will dump the production database and import it to your local database.${colors.reset}`
        );
        console.log(
          `${colors.yellow}Note: This might take a while depending on the database size.${colors.reset}\n`
        );

        // Create a temporary directory for the database dump
        if (!fs.existsSync(path.join(__dirname, "tmp"))) {
          fs.mkdirSync(path.join(__dirname, "tmp"));
        }

        const dumpFilePath = path.join(__dirname, "tmp", "prod_dump.sql");

        console.log(
          `\n${colors.yellow}Dumping production database...${colors.reset}`
        );
        execSync(
          `pg_dump "${dbUrl}" --format=p --no-owner --no-acl > "${dumpFilePath}"`,
          { stdio: "inherit" }
        );

        console.log(
          `\n${colors.yellow}Importing to local database...${colors.reset}`
        );
        execSync(
          `psql "postgres://postgres:postgres@localhost:5433/medusa_local" < "${dumpFilePath}"`,
          { stdio: "inherit" }
        );

        console.log(
          `\n${colors.green}✓ Database import completed successfully${colors.reset}`
        );

        // ---- Run database migrations to ensure schema is up-to-date ----
        runDatabaseMigrations();

        // ---- Enhanced Region ID synchronization ----
        console.log(
          `\n${colors.yellow}Starting region ID synchronization...${colors.reset}`
        );

        // Scan frontend for region IDs
        const detectedRegionIds = await detectFrontendRegionIds();

        // Connect to the database to manage region IDs
        const client = new Client({
          host: "localhost",
          port: 5433,
          user: "postgres",
          password: "postgres",
          database: "medusa_local",
        });

        await client.connect();
        console.log(
          `${colors.green}✓ Connected to database for region sync${colors.reset}`
        );

        // Fix any database schema issues
        await fixDatabaseSchema(client);

        // Get available regions from the database
        const availableRegions = await getAvailableRegions(client);

        console.log(
          `\n${colors.blue}Available regions in your local database:${colors.reset}`
        );
        availableRegions.forEach((region, index) => {
          console.log(
            `${index + 1}. ${region.name} (${region.id}) - Currency: ${region.currency_code}`
          );
        });

        // If we detected region IDs in the frontend, try to synchronize them
        if (detectedRegionIds.length > 0) {
          console.log(
            `\n${colors.yellow}Found ${detectedRegionIds.length} region IDs to check:${colors.reset}`
          );
          detectedRegionIds.forEach((id) => console.log(`- ${id}`));

          // Find regions by currency code
          const usRegion = availableRegions.find(
            (r) => r.currency_code === "usd"
          );
          const euRegion = availableRegions.find(
            (r) => r.currency_code === "eur"
          );

          // Problematic regions to fix
          const problemRegions = [];

          // For each detected ID, update database references
          for (const oldRegionId of detectedRegionIds) {
            if (!availableRegions.some((r) => r.id === oldRegionId)) {
              problemRegions.push(oldRegionId);

              // Determine which region to replace with
              let replacementRegion;

              // If the region ID starts with 'us' or has 'us' in the middle, use the US region
              if (
                (oldRegionId.includes("us") ||
                  oldRegionId === "reg_01JVK89Q8PEA1EMJS7FPBN12VF") &&
                usRegion
              ) {
                replacementRegion = usRegion;
              }
              // Otherwise fallback to any available region, preferring US if available
              else {
                replacementRegion = usRegion || euRegion || availableRegions[0];
              }

              if (replacementRegion) {
                console.log(
                  `\n${colors.yellow}Replacing region ${oldRegionId} with ${replacementRegion.name} (${replacementRegion.id})...${colors.reset}`
                );

                const updatedTables = await updateRegionReferences(
                  client,
                  oldRegionId,
                  replacementRegion.id
                );

                if (updatedTables > 0) {
                  console.log(
                    `${colors.green}✓ Updated references across ${updatedTables} tables${colors.reset}`
                  );
                } else {
                  console.log(
                    `${colors.yellow}No database references found for ${oldRegionId}${colors.reset}`
                  );
                }
              }
            }
          }

          // Generate a script to fix region issues if we found problematic regions
          if (problemRegions.length > 0) {
            const defaultRegionId = usRegion
              ? usRegion.id
              : availableRegions[0].id;
            const scriptPath = generateRegionFixScript(
              problemRegions,
              defaultRegionId
            );
          }
        } else {
          console.log(
            `${colors.green}✓ No frontend region IDs detected${colors.reset}`
          );
        }

        // Close the database connection
        await client.end();
      }
    } else {
      // For non-production data, we'll use the standard Medusa initialization
      console.log(
        `\n${colors.yellow}Initializing with fresh database...${colors.reset}`
      );

      // Clear the database first
      console.log(`${colors.yellow}Clearing local database...${colors.reset}`);
      try {
        // First terminate all connections to the database
        execSync(
          `docker exec projectnightkidzshop-postgres-1 psql -U postgres -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = 'medusa_local' AND pid <> pg_backend_pid();"`,
          { stdio: "inherit" }
        );

        // Then drop and recreate the database
        execSync(
          `docker exec projectnightkidzshop-postgres-1 psql -U postgres -c "DROP DATABASE IF EXISTS medusa_local;"`,
          { stdio: "inherit" }
        );
        execSync(
          `docker exec projectnightkidzshop-postgres-1 psql -U postgres -c "CREATE DATABASE medusa_local;"`,
          { stdio: "inherit" }
        );
        console.log(`${colors.green}✓ Local database cleared${colors.reset}`);
      } catch (err) {
        console.log(
          `${colors.red}Error clearing database: ${err.message}${colors.reset}`
        );
      }
    }

    // Initialize Medusa backend
    console.log(
      `\n${colors.yellow}Initializing Medusa backend...${colors.reset}`
    );
    console.log(
      `${colors.cyan}Installing backend dependencies...${colors.reset}`
    );

    // Change to backend directory
    process.chdir(path.join(__dirname, "backend"));

    // Install dependencies
    execSync("npm install", { stdio: "inherit" });

    if (initWithProductionData.toLowerCase() !== "yes") {
      console.log(
        `${colors.cyan}Running database migrations...${colors.reset}`
      );

      // Run Medusa migrations
      execSync("npx medusa db:migrate", { stdio: "inherit" });

      console.log(
        `${colors.cyan}Seeding database with initial data...${colors.reset}`
      );

      // Seed the database
      execSync("npx medusa seed --seed-file=./src/scripts/seed.ts", {
        stdio: "inherit",
      });
    }

    // Initialize storefront
    console.log(`\n${colors.yellow}Initializing storefront...${colors.reset}`);
    console.log(
      `${colors.cyan}Installing storefront dependencies...${colors.reset}`
    );

    // Change to storefront directory - Fix the path by going back to project root first
    process.chdir(path.join(__dirname)); // Go back to project root
    process.chdir(path.join(__dirname, "storefront"));

    // Install dependencies
    execSync("npm install", { stdio: "inherit" });

    // Clean frontend cache again after setup
    cleanFrontendCaches();

    console.log(
      `\n${colors.green}✓ Setup completed successfully!${colors.reset}`
    );
    console.log(
      `\n${colors.cyan}Important browser cache instructions:${colors.reset}`
    );
    console.log(
      `${colors.yellow}1. Open your browser's developer tools (F12)${colors.reset}`
    );
    console.log(
      `${colors.yellow}2. Go to Application > Storage > Local Storage${colors.reset}`
    );
    console.log(
      `${colors.yellow}3. Clear storage for localhost:8000${colors.reset}`
    );
    console.log(
      `${colors.yellow}4. Also clear Session Storage if available${colors.reset}`
    );

    console.log(`\n${colors.cyan}Next steps:${colors.reset}`);
    console.log(
      `${colors.blue}1. Start the backend:  cd backend && npm run dev${colors.reset}`
    );
    console.log(
      `${colors.blue}2. Start the storefront:  cd storefront && npm run dev${colors.reset}`
    );
    console.log(
      `\n${colors.green}Enjoy your local development environment!${colors.reset}`
    );
  } catch (err) {
    console.log(
      `\n${colors.red}Error during setup: ${err.message}${colors.reset}`
    );
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
