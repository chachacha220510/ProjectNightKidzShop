import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"
import { cache } from "react"

export const listCategories = cache(async function(query?: Record<string, any>) {
  // Skip data fetching if we're on the server during build
  if (process.env.VERCEL && process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
    return []
  }

  const next = {
    ...(await getCacheOptions("categories")),
  }

  const limit = query?.limit || 100

  try {
    return sdk.client
      .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
        "/store/product-categories",
        {
          query: {
            fields:
              "*category_children, *products, *parent_category, *parent_category.parent_category",
            limit,
            ...query,
          },
          next,
          cache: "force-cache",
        }
      )
      .then(({ product_categories }) => product_categories)
  } catch (error) {
    console.error("Error fetching categories:", error)
    return []
  }
})

export const getCategoryByHandle = cache(async function(categoryHandle: string[]) {
  const handle = `${categoryHandle.join("/")}`

  // Skip data fetching if we're on the server during build
  if (process.env.VERCEL && process.env.NODE_ENV === 'production' && typeof window === 'undefined') {
    return {
      product_categories: [{
        id: "placeholder",
        handle: handle,
        name: handle,
        products: [],
        category_children: []
      }]
    }
  }

  const next = {
    ...(await getCacheOptions("categories")),
  }

  try {
    return sdk.client
      .fetch<HttpTypes.StoreProductCategoryListResponse>(
        `/store/product-categories`,
        {
          query: {
            fields: "*category_children, *products",
            handle,
          },
          next,
          cache: "force-cache",
        }
      )
      .then(({ product_categories }) => ({ product_categories }))
  } catch (error) {
    console.error("Error fetching category by handle:", error)
    return {
      product_categories: [{
        id: "placeholder",
        handle: handle,
        name: handle,
        products: [],
        category_children: []
      }]
    }
  }
})
