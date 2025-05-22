import Medusa from "@medusajs/js-sdk"

// Defaults to standard port for Medusa server
let MEDUSA_BACKEND_URL = "http://localhost:9000"

if (process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL) {
  MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL
}

// Check if we're in a build environment (server-side, production, not client)
const isBuildEnv = 
  typeof window === "undefined" && 
  process.env.NODE_ENV === "production" &&
  process.env.VERCEL

// Create SDK instance
export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})

// Special NextJS data fetching function to handle static generation
export async function medusaRequest(
  resource: string,
  options?: RequestInit,
  noAuth = false
) {
  // During Vercel build, return mock data
  if (isBuildEnv) {
    console.log(`Build environment detected, mocking data for: ${resource}`)
    return getMockData(resource)
  }

  // Runtime - make real requests
  const authHeaders: Record<string, string> = {}
  
  // Add publishable API key if available and needed
  if (!noAuth && process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY) {
    authHeaders['x-publishable-api-key'] = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
  }

  // Make the actual request
  try {
    const res = await fetch(`${MEDUSA_BACKEND_URL}${resource}`, {
      ...(options && options),
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(options?.headers && options.headers),
      },
    })

    const data = await res.json()

    return data
  } catch (error) {
    console.error(`Error fetching from Medusa: ${error}`)
    return null
  }
}

// Mock response data for build time
function getMockData(resource: string) {
  // Most common endpoints that Next.js tries to fetch during build
  if (resource.includes("/store/collections")) {
    return { 
      collections: [{ 
        id: "dummy-collection", 
        handle: "dummy", 
        title: "Dummy Collection",
        products: []
      }] 
    }
  }
  
  if (resource.includes("/store/regions")) {
    return { 
      regions: [{
        id: "dummy-region",
        name: "United States",
        currency_code: "usd",
        countries: [{ 
          id: "us", 
          iso_2: "us", 
          display_name: "United States" 
        }]
      }] 
    }
  }
  
  if (resource.includes("/store/product-categories")) {
    return { 
      product_categories: [{ 
        id: "dummy-category", 
        handle: "dummy", 
        name: "Dummy Category"
      }] 
    }
  }
  
  if (resource.includes("/store/products")) {
    return {
      products: []
    }
  }
  
  // Default empty response
  return {}
} 