import "server-only"
import { cookies } from "next/headers"

export const getAuthHeaders = async (): Promise<{ authorization: string } | {}> => {
  const token = (await cookies()).get("_medusa_jwt")?.value

  if (token) {
    return { authorization: `Bearer ${token}` }
  }

  return {}
}

export const setAuthToken = async (token: string) => {
  (await cookies()).set("_medusa_jwt", token, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
  })
}

export const removeAuthToken = async () => {
  (await cookies()).set("_medusa_jwt", "", {
    maxAge: -1,
  })
}

export const getCartId = async () => {
  try {
    return (await cookies()).get("_medusa_cart_id")?.value
  } catch (error) {
    console.error("Error getting cart ID from cookies:", error)
    return null
  }
}

export const setCartId = async (cartId: string) => {
  try {
    (await cookies()).set("_medusa_cart_id", cartId, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: true,
      sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  })
  } catch (error) {
    console.error("Error setting cart ID cookie:", error)
  }
}

export const removeCartId = async () => {
  (await cookies()).set("_medusa_cart_id", "", { maxAge: -1 })
}
