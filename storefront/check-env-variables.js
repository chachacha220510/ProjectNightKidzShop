const c = require("ansi-colors");

/**
 * Checks if required environment variables are set. If not, it throws an error
 * with a message indicating which variables are missing.
 * @returns {void}
 */
function checkEnvVariables() {
  const requiredEnvVars = ["NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY"];
  const missingEnvVars = requiredEnvVars.filter(
    (envVar) => !process.env[envVar]
  );

  if (missingEnvVars.length > 0) {
    throw new Error(`
🚫 Error: Missing required environment variables

  ${missingEnvVars.join("\n  ")}
    ${
      missingEnvVars.includes("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY")
        ? "Learn how to create a publishable key: https://docs.medusajs.com/v2/resources/storefront-development/publishable-api-keys"
        : ""
    }

Please set these variables in your .env file or environment before starting the application.
`);
  }
}

module.exports = checkEnvVariables;
