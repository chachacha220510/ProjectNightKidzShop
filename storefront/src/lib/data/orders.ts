"use server"

import { sdk } from "@lib/config"
import medusaError from "@lib/util/medusa-error"
import { cache } from "react"
import { getAuthHeaders } from "./cookies"

export const retrieveOrder = cache(async function (id: string) {
  return sdk.store.order
    .retrieve(
      id,
      { fields: "*payment_collections.payments" },
      { next: { tags: ["order"] }, ...await getAuthHeaders() }
    )
    .then(({ order }) => order)
    .catch((err) => medusaError(err))
})

export const getAndVerifyOrder = async (input: any) => {
  return sdk.store.order
    .confirm(input, { next: { tags: ["order"] }, ...await getAuthHeaders() })
    .then(({ order }) => order)
    .catch((err) => medusaError(err))
}

export const retrieveOrders = cache(async function () {
  return sdk.store.order
    .getCustomerOrders(
      {},
      { next: { tags: ["order"] }, ...await getAuthHeaders() }
    )
    .then(({ orders }) => orders)
    .catch((err) => {
      return []
    })
})

export const getOrder = cache(async function (id: string) {
  return retrieveOrder(id)
})

export const listOrders = cache(async function (
  limit: number = 10,
  offset: number = 0
) {
  return sdk.store.order
    .list({ limit, offset }, { next: { tags: ["order"] }, ...await getAuthHeaders() })
    .then(({ orders }) => orders)
    .catch((err) => medusaError(err))
})
