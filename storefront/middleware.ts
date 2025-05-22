import { HttpTypes } from "@medusajs/types"
import { NextRequest, NextResponse } from "next/server"

const BACKEND_URL = process.env.MEDUSA_BACKEND_URL || "http://localhost:9000"
const PUBLISHABLE_API_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"

const regionMapCache = {
  regionMap: new Map<string, HttpTypes.StoreRegion>(),
  regionMapUpdated: Date.now(),
}

async function getRegionMap(cacheId: string) {
  const { regionMap, regionMapUpdated } = regionMapCache

  // Skip API calls during Vercel static builds
  if (process.env.VERCEL && process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_VERCEL_URL) {
    return regionMap
  }

  if (!BACKEND_URL) {
    console.error("Missing MEDUSA_BACKEND_URL environment variable")
    return regionMap
  }

  // Cache region map for 24 hours
  if (
    regionMap.size === 0 ||
    regionMapUpdated < Date.now() - 1000 * 60 * 60 * 24
  ) {
    try {
      const res = await fetch(`${BACKEND_URL}/store/regions`, {
        headers: {
          ...(PUBLISHABLE_API_KEY && {
            "x-publishable-api-key": PUBLISHABLE_API_KEY,
          }),
        },
        cache: "force-cache",
        next: {
          tags: ["regions"],
        },
      })
      
      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`)
      }

      const { regions } = await res.json()

      regions.forEach((region: HttpTypes.StoreRegion) => {
        region.countries?.forEach((c) => {
          regionMap.set(c.iso_2.toLowerCase(), region)
        })
      })

      regionMapCache.regionMapUpdated = Date.now()
    } catch (error) {
      console.error("Error fetching regions in middleware:", error)
      // In case of error, we'll use the existing map or an empty one
    }
  }

  return regionMap
}

function getCountryCodeFromUrl(url: URL) {
  const parts = url.pathname.split("/")
  return parts[1]
}

function countryCodeExists(countryCode: string, regionMap: Map<string, any>) {
  return regionMap.has(countryCode)
}

/**
 * Checks if a given country code exists in the region map.
 * @param {string} countryCode - The country code to check.
 * @returns {boolean} - Whether or not the country code exists.
 */
export async function middleware(request: NextRequest) {
  const url = request.nextUrl

  try {
    const countryCode = getCountryCodeFromUrl(url)

    // Proceed with handling the request
    const cacheId = request.headers.get("x-vercel-id") || request.ip || "unknown"
    const regionMap = await getRegionMap(cacheId)

    // if we're on a deployment and there is no country code
    // we redirect to the default region
    if (!countryCode) {
      // Get the default country code from the header if it exists
      let defaultCountryCode = request.headers.get("x-vercel-country")?.toLowerCase() || DEFAULT_REGION

      // Make sure that the default country code exists in the region map
      if (!countryCodeExists(defaultCountryCode, regionMap)) {
        defaultCountryCode = DEFAULT_REGION
      }

      // Construct the redirect URL
      const redirectUrl = url.pathname === "/" ? `/${defaultCountryCode}` : `/${defaultCountryCode}${url.pathname}`

      return NextResponse.redirect(new URL(redirectUrl, request.url))
    }

    const response = NextResponse.next()

    // Add the region to the request object
    const region = regionMap.get(countryCode)
    if (region && countryCode) {
      response.cookies.set("_medusa_region", region.id, {
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      })
    }

    return response
  } catch (error) {
    console.error("Middleware error:", error)
    // Just proceed with the request in case of errors
    return NextResponse.next()
  }
}

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /_static (inside /public)
     * 4. all root files inside /public (e.g. /favicon.ico)
     */
    "/((?!api/|_next/|_static/|_vercel|[\\w-]+\\.\\w+).*)",
  ],
} 