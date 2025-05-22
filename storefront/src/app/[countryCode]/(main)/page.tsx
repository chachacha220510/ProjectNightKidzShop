import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import { listCollections } from "@lib/data/collections"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"

export const metadata: Metadata = {
  title: "NightKidz Shop - Premium Streetwear",
  description:
    "Premium streetwear and urban fashion from NightKidz. Express your style with our exclusive collection.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params
  const { countryCode } = params

  // Fetch region with error handling
  let region: HttpTypes.StoreRegion | null = null
  try {
    region = await getRegion(countryCode)
  } catch (error) {
    console.error("Error fetching region:", error)
    // Create a fallback region if API call fails
    region = {
      id: "reg_fallback",
      name: "United States",
      currency_code: "usd",
      tax_rate: 0,
      countries: [
        {
          id: "us",
          iso_2: "us",
          display_name: "United States",
        },
      ],
    } as HttpTypes.StoreRegion
  }

  // Fetch collections with error handling
  let collections = []
  try {
    const result = await listCollections({
      fields: "id, handle, title",
    })
    collections = result.collections || []
  } catch (error) {
    console.error("Error fetching collections:", error)
    // Use empty collections array as fallback
  }

  return (
    <>
      <Hero />
      <div className="py-12">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>
    </>
  )
}
