import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listCategories = async (query?: Record<string, any>) => {
  // Skip backend connection during build if the environment variable is set
  if (process.env.SKIP_MEDUSA_CONNECTION === "true" && process.env.NODE_ENV === "production") {
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
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = `${categoryHandle.join("/")}`

  // Skip backend connection during build if the environment variable is set
  if (process.env.SKIP_MEDUSA_CONNECTION === "true" && process.env.NODE_ENV === "production") {
    return {
      id: "placeholder",
      handle: handle,
      name: handle,
      products: [],
      category_children: []
    } as any
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
      .then(({ product_categories }) => product_categories[0])
  } catch (error) {
    console.error("Error fetching category by handle:", error)
    return {
      id: "placeholder",
      handle: handle,
      name: handle,
      products: [],
      category_children: []
    } as any
  }
}
