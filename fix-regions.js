#!/usr/bin/env node

/**
 * Script to fix region references in the local database
 * This script updates any references to the old region ID with the new one
 */

const { Client } = require("pg");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  console.log("NightKidz Shop - Region Reference Fix");
  console.log(
    "This script will update region references in your local database."
  );

  // Define colors for console output
  const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
  };

  try {
    console.log(`\n${colors.yellow}Connecting to database...${colors.reset}`);

    const client = new Client({
      host: "localhost",
      port: 5433,
      user: "postgres",
      password: "postgres",
      database: "medusa_local",
    });

    await client.connect();
    console.log(`${colors.green}✓ Connected to database${colors.reset}`);

    // Get the old production region ID
    const productionRegionId = await new Promise((resolve) => {
      rl.question(
        `\n${colors.cyan}Enter the production region ID that needs to be replaced (e.g., reg_01JVK89Q8PEA1EMJS7FPBN12VF): ${colors.reset}`,
        resolve
      );
    });

    if (!productionRegionId) {
      console.log(
        `${colors.red}No region ID provided. Exiting...${colors.reset}`
      );
      await client.end();
      rl.close();
      return;
    }

    // Get all available regions
    const { rows: regions } = await client.query(
      "SELECT id, name FROM region WHERE deleted_at IS NULL"
    );

    console.log(
      `\n${colors.blue}Available regions in your local database:${colors.reset}`
    );
    regions.forEach((region, index) => {
      console.log(`${index + 1}. ${region.name} (${region.id})`);
    });

    // Let user select which region to use as replacement
    const selection = await new Promise((resolve) => {
      rl.question(
        `\n${colors.cyan}Enter the number of the region to use as replacement: ${colors.reset}`,
        resolve
      );
    });

    const selectedIndex = parseInt(selection) - 1;
    if (
      isNaN(selectedIndex) ||
      selectedIndex < 0 ||
      selectedIndex >= regions.length
    ) {
      console.log(`${colors.red}Invalid selection. Exiting...${colors.reset}`);
      await client.end();
      rl.close();
      return;
    }

    const newRegionId = regions[selectedIndex].id;
    console.log(
      `\n${colors.yellow}Replacing region ${productionRegionId} with ${newRegionId}...${colors.reset}`
    );

    // Update references in various tables
    // The exact tables depend on your database schema, but these are common ones in Medusa
    const tables = [
      { name: "cart", column: "region_id" },
      { name: "customer", column: "region_id" },
      { name: "discount_condition_region", column: "region_id" },
      { name: "discount_region", column: "region_id" },
      { name: "order", column: "region_id" },
      { name: "payment_collection", column: "region_id" },
      { name: "payment_session", column: "region_id" },
      { name: "shipping_option", column: "region_id" },
    ];

    let updatedRecords = 0;

    for (const table of tables) {
      try {
        const { rowCount } = await client.query(
          `UPDATE ${table.name} SET ${table.column} = $1 WHERE ${table.column} = $2`,
          [newRegionId, productionRegionId]
        );

        if (rowCount > 0) {
          console.log(
            `${colors.green}✓ Updated ${rowCount} records in ${table.name}${colors.reset}`
          );
          updatedRecords += rowCount;
        }
      } catch (err) {
        // Handle case where table might not exist
        console.log(
          `${colors.yellow}⚠ Skipping table ${table.name}: ${err.message}${colors.reset}`
        );
      }
    }

    console.log(
      `\n${colors.green}✓ Completed region reference updates${colors.reset}`
    );
    console.log(
      `${colors.blue}Total records updated: ${updatedRecords}${colors.reset}`
    );
    console.log(`\n${colors.cyan}Next steps:${colors.reset}`);
    console.log(
      `${colors.blue}1. Clear browser caches (localStorage, sessionStorage)${colors.reset}`
    );
    console.log(
      `${colors.blue}2. Delete the .next/cache directory in the storefront${colors.reset}`
    );
    console.log(
      `${colors.blue}3. Restart both the backend and storefront services${colors.reset}`
    );

    await client.end();
  } catch (err) {
    console.log(`\n${colors.red}Error: ${err.message}${colors.reset}`);
  } finally {
    rl.close();
  }
}

main();
