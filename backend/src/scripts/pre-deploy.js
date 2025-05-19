/**
 * Pre-deployment script for Railway
 *
 * This script runs database migrations and other setup tasks before the application starts.
 * It uses the correct Medusa 2.0 commands.
 */

const { execSync } = require("child_process");
const path = require("path");

console.log("Starting pre-deployment tasks...");

try {
  // Run database migrations using the correct Medusa 2.0 command
  console.log("Running database migrations...");
  execSync("npx medusa db:migrate", {
    stdio: "inherit",
    env: process.env,
  });

  console.log("✅ Database migrations completed successfully");

  // Run any additional pre-deployment tasks here

  console.log("✅ All pre-deployment tasks completed");
} catch (error) {
  console.error("❌ Pre-deployment tasks failed:");
  console.error(error);
  process.exit(1);
}
