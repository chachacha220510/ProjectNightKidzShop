import { Metadata } from "next"
import { notFound } from "next/navigation"

import { getCategoryByHandle, listCategories } from "@lib/data/categories"
import { listRegions } from "@lib/data/regions"
import { StoreProductCategory, StoreRegion } from "@medusajs/types"
import CategoryTemplate from "@modules/categories/templates"
import { SortOptions } from "@modules/store/components/refinement-list/sort-products"

type Props = {
  params: { category: string[]; countryCode: string }
  searchParams: {
    sortBy?: SortOptions
    page?: string
  }
}

// Skip generateStaticParams during Vercel builds to avoid connection errors
export async function generateStaticParams() {
  // Skip in Vercel production builds
  if (process.env.VERCEL && process.env.NODE_ENV === 'production') {
    return []
  }

  try {
    const product_categories = await listCategories()

    if (!product_categories || product_categories.length === 0) {
      return []
    }

    const countryCodes = await listRegions().then((regions: StoreRegion[]) =>
      regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
    )

    const categoryHandles = product_categories.map(
      (category: any) => category.handle
    )

    const staticParams = countryCodes
      ?.map((countryCode: string | undefined) =>
        categoryHandles.map((handle: any) => ({
          countryCode,
          category: [handle],
        }))
      )
      .flat()

    return staticParams
  } catch (error) {
    console.error("Error generating static params:", error)
    return []
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const response = await getCategoryByHandle(params.category)
    const product_categories = response.product_categories

    if (!product_categories || product_categories.length === 0) {
      return {
        title: "Category | Medusa Store",
        description: "Category page",
      }
    }

    const title = product_categories
      .map((category: StoreProductCategory) => category.name)
      .join(" | ")

    const description =
      product_categories[product_categories.length - 1].description ??
      `${title} category.`

    return {
      title: `${title} | Medusa Store`,
      description,
      alternates: {
        canonical: `${params.category.join("/")}`,
      },
    }
  } catch (error) {
    console.error("Error generating metadata:", error)
    return {
      title: "Category | Medusa Store",
      description: "Category page",
    }
  }
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { sortBy, page } = searchParams

  try {
    const response = await getCategoryByHandle(params.category)
    const product_categories = response.product_categories

    if (!product_categories) {
      notFound()
    }

    return (
      <CategoryTemplate
        categories={product_categories}
        sortBy={sortBy}
        page={page}
        countryCode={params.countryCode}
      />
    )
  } catch (error) {
    console.error("Error in CategoryPage:", error)
    notFound()
  }
}
