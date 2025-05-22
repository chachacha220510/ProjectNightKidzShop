import Medusa from "@medusajs/js-sdk"

// Defaults to standard port for Medusa server
let MEDUSA_BACKEND_URL = "http://localhost:9000"

if (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL) {
  MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
}

// Add some basic environment variable validation
if (process.env.NODE_ENV === "production" && 
    (!process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || 
     !process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY)) {
  console.warn(
    "Warning: Missing required environment variables in production. " +
    "Make sure NEXT_PUBLIC_MEDUSA_BACKEND_URL and NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY are set."
  )
}

// Log the URL in non-production environments for debugging
if (process.env.NODE_ENV !== "production") {
  console.log("Medusa Backend URL:", MEDUSA_BACKEND_URL)
}

const sdkConfig = {
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  maxRetries: 2,  // Reduced from 3 to 2
  timeout: 10000,  // 10 second timeout
}

// Only add publishable key if it exists to avoid "undefined" string issues
if (process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY) {
  sdkConfig.publishableKey = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
}

export const sdk = new Medusa(sdkConfig)
