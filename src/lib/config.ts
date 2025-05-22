import Medusa from "@medusajs/js-sdk"

// Defaults to standard port for Medusa server
let MEDUSA_BACKEND_URL = "http://localhost:9000"

if (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL) {
  MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
}

// Set a dummy publishable key for Vercel builds
const isVercelBuild = 
  process.env.NODE_ENV === "production" && 
  process.env.VERCEL && 
  typeof window === "undefined"

// Create a simple SDK instance without customFetch
export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || 
    (isVercelBuild ? "pk_dummy_build_time_key" : undefined),
}) 