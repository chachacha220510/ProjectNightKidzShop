"use server"

import { medusaRequest, sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const retrieveCollection = async (id: string) => {
  const next = {
    ...(await getCacheOptions("collections")),
  }

  // Try our custom medusaRequest first for better build-time handling
  try {
    const { collection } = await medusaRequest(`/store/collections/${id}`)
    if (collection) return collection
  } catch (e) {
    console.error("Error using medusaRequest, falling back to SDK", e)
  }

  // Fall back to SDK
  return sdk.client
    .fetch<{ collection: HttpTypes.StoreCollection }>(
      `/store/collections/${id}`,
      {
        next,
        cache: "force-cache",
      }
    )
    .then(({ collection }) => collection)
}

export const listCollections = async (
  queryParams: Record<string, string> = {}
): Promise<{ collections: HttpTypes.StoreCollection[]; count: number }> => {
  const next = {
    ...(await getCacheOptions("collections")),
  }

  queryParams.limit = queryParams.limit || "100"
  queryParams.offset = queryParams.offset || "0"

  // Try our custom medusaRequest first for better build-time handling
  try {
    const { collections } = await medusaRequest(`/store/collections${
      Object.keys(queryParams).length ? 
      '?' + new URLSearchParams(queryParams).toString() : 
      ''
    }`)
    if (collections) return { collections, count: collections.length }
  } catch (e) {
    console.error("Error using medusaRequest, falling back to SDK", e)
  }

  // Fall back to SDK
  return sdk.client
    .fetch<{ collections: HttpTypes.StoreCollection[]; count: number }>(
      "/store/collections",
      {
        query: queryParams,
        next,
        cache: "force-cache",
      }
    )
    .then(({ collections }) => ({ collections, count: collections.length }))
}

export const getCollectionByHandle = async (
  handle: string
): Promise<HttpTypes.StoreCollection> => {
  const next = {
    ...(await getCacheOptions("collections")),
  }

  // Try our custom medusaRequest first for better build-time handling
  try {
    const { collections } = await medusaRequest(`/store/collections?handle=${handle}&fields=*products`)
    if (collections && collections.length > 0) return collections[0]
  } catch (e) {
    console.error("Error using medusaRequest, falling back to SDK", e)
  }

  // Fall back to SDK
  return sdk.client
    .fetch<HttpTypes.StoreCollectionListResponse>(`/store/collections`, {
      query: { handle, fields: "*products" },
      next,
      cache: "force-cache",
    })
    .then(({ collections }) => collections[0])
}
