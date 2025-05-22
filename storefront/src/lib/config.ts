import Medusa from "@medusajs/js-sdk"

// Determine the appropriate backend URL based on environment
let MEDUSA_BACKEND_URL = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || process.env.MEDUSA_BACKEND_URL

// For Vercel builds, we need to handle differently to avoid connection errors
if (process.env.NODE_ENV === "production" && process.env.VERCEL) {
  console.log("Running on Vercel production - using configured backend URL:", MEDUSA_BACKEND_URL)
  
  // If building on Vercel and no URL is set, use a dummy URL for build time
  if (!MEDUSA_BACKEND_URL) {
    console.warn("Warning: Backend URL not set in Vercel environment variables")
    // Don't set a fallback here - we'll handle missing URLs in the customFetch
  }
}

export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL || "",
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
  
  // Add custom fetch for handling build-time requests when we're on Vercel
  customFetch: (...args) => {
    // During build in Vercel, we're static generating pages
    // We don't want to make actual API calls during this phase
    if (process.env.NODE_ENV === "production" && 
        process.env.VERCEL && 
        typeof window === "undefined") {
      console.log("Skipping fetch during Vercel build for path:", args[0])
      
      // Return a mock response instead of making a real API call
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => {
          // Return appropriate dummy data based on the endpoint
          const url = args[0].toString()
          
          if (url.includes("/store/collections")) {
            return Promise.resolve({ 
              collections: [{ 
                id: "dummy-collection", 
                handle: "dummy", 
                title: "Dummy Collection",
                products: []
              }] 
            })
          }
          
          if (url.includes("/store/regions")) {
            return Promise.resolve({ 
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
            })
          }
          
          if (url.includes("/store/product-categories")) {
            return Promise.resolve({ 
              product_categories: [{ 
                id: "dummy-category", 
                handle: "dummy", 
                name: "Dummy Category",
                products: []
              }] 
            })
          }
          
          // Default empty response
          return Promise.resolve({})
        }
      } as Response)
    }
    
    // For runtime or development, use the actual fetch
    return fetch(...args)
  }
})
