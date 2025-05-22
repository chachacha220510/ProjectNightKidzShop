import { NextRequest, NextResponse } from "next/server"
import { sdk } from "@lib/config"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  try {
    // Get cart ID from cookies
    const cartId = cookies().get("_medusa_cart_id")?.value
    
    // If no cart ID, return early
    if (!cartId) {
      return NextResponse.json({ 
        status: "no_cart",
        message: "No cart ID found in cookies" 
      })
    }
    
    // Try to retrieve the cart
    try {
      const { cart } = await sdk.store.cart.retrieve(cartId)
      return NextResponse.json({ 
        status: "success",
        cart_id: cartId,
        cart: {
          id: cart.id,
          items_count: cart.items?.length || 0,
          region_id: cart.region_id,
        }
      })
    } catch (cartError: any) {
      return NextResponse.json({
        status: "cart_error",
        message: cartError.message,
        cart_id: cartId
      }, { status: 400 })
    }
  } catch (error: any) {
    return NextResponse.json({ 
      status: "error", 
      message: error.message 
    }, { status: 500 })
  }
} 