"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listRegions = async () => {
  // Skip backend connection during build if the environment variable is set
  if (process.env.SKIP_MEDUSA_CONNECTION === "true" && process.env.NODE_ENV === "production") {
    return [{
      id: "dummy-region",
      name: "United States",
      currency_code: "usd",
      tax_rate: 0,
      countries: [
        {
          id: "us",
          iso_2: "us",
          iso_3: "usa",
          name: "United States",
          display_name: "United States",
          region_id: "dummy-region",
          num_code: 840,
        }
      ]
    }] as HttpTypes.StoreRegion[]
  }

  const next = {
    ...(await getCacheOptions("regions")),
  }

  try {
    return sdk.client
      .fetch<{ regions: HttpTypes.StoreRegion[] }>(`/store/regions`, {
        method: "GET",
        next,
        cache: "force-cache",
      })
      .then(({ regions }) => regions)
      .catch(medusaError)
  } catch (error) {
    console.error("Error fetching regions:", error)
    return [] as HttpTypes.StoreRegion[]
  }
}

export const retrieveRegion = async (id: string) => {
  // Skip backend connection during build if the environment variable is set
  if (process.env.SKIP_MEDUSA_CONNECTION === "true" && process.env.NODE_ENV === "production") {
    return {
      id: "dummy-region",
      name: "United States",
      currency_code: "usd",
      tax_rate: 0,
      countries: [
        {
          id: "us",
          iso_2: "us",
          iso_3: "usa",
          name: "United States",
          display_name: "United States",
          region_id: "dummy-region",
          num_code: 840,
        }
      ]
    } as HttpTypes.StoreRegion
  }

  const next = {
    ...(await getCacheOptions(["regions", id].join("-"))),
  }

  try {
    return sdk.client
      .fetch<{ region: HttpTypes.StoreRegion }>(`/store/regions/${id}`, {
        method: "GET",
        next,
        cache: "force-cache",
      })
      .then(({ region }) => region)
      .catch(medusaError)
  } catch (error) {
    console.error(`Error fetching region by id ${id}:`, error)
    return null
  }
}

const regionMap = new Map<string, HttpTypes.StoreRegion>()

export const getRegion = async (countryCode: string) => {
  try {
    if (regionMap.has(countryCode)) {
      return regionMap.get(countryCode)
    }

    const regions = await listRegions()

    if (!regions) {
      return null
    }

    regions.forEach((region) => {
      region.countries?.forEach((c) => {
        regionMap.set(c?.iso_2 ?? "", region)
      })
    })

    const region = countryCode
      ? regionMap.get(countryCode)
      : regionMap.get("us")

    return region
  } catch (e: any) {
    return null
  }
}
