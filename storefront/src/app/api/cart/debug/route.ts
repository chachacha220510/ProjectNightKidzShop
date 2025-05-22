import { NextRequest, NextResponse } from "next/server"
import { sdk } from "@lib/config"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  try {
    // Get all cookie information
    const cookieStore = cookies()
    const allCookies = cookieStore.getAll()
    const cartId = cookieStore.get("_medusa_cart_id")?.value
    
    // If no cart ID, return all cookies for debugging
    if (!cartId) {
      return NextResponse.json({ 
        status: "no_cart",
        message: "No cart ID found in cookies",
        cookies: allCookies.map(c => ({ name: c.name, value: c.value.substring(0, 5) + '...' })),
        headers: Object.fromEntries(req.headers)
      })
    }
    
    // Try to retrieve the cart with full details
    try {
      const { cart } = await sdk.store.cart.retrieve(cartId)
      return NextResponse.json({ 
        status: "success",
        cart_id: cartId,
        cart: {
          id: cart.id,
          items: cart.items?.map(item => ({
            id: item.id,
            title: item.title,
            variant_id: item.variant_id,
            quantity: item.quantity
          })) || [],
          items_count: cart.items?.length || 0,
          region_id: cart.region_id,
          total: cart.total,
          created_at: cart.created_at,
          updated_at: cart.updated_at
        },
        sdk_config: {
          baseUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "Not configured"
        },
        cookies: allCookies.map(c => ({ name: c.name, value: c.name.includes("cart") ? c.value : c.value.substring(0, 5) + '...' }))
      })
    } catch (cartError: any) {
      return NextResponse.json({
        status: "cart_error",
        message: cartError.message,
        error_details: cartError.stack?.split("\n").slice(0, 3) || "No stack trace",
        cart_id: cartId,
        sdk_config: {
          baseUrl: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "Not configured"
        },
        cookies: allCookies.map(c => ({ name: c.name, value: c.name.includes("cart") ? c.value : c.value.substring(0, 5) + '...' }))
      }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({ 
      status: "error", 
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 3) || "No stack trace"
    }, { status: 500 })
  }
} 