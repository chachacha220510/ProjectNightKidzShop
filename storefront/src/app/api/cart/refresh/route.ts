import { NextRequest, NextResponse } from "next/server"
import { enrichLineItems, retrieveCart } from "@lib/data/cart"
import { cookies } from "next/headers"

export async function GET(req: NextRequest) {
  try {
    // Get cart ID from cookies
    const cookieStore = cookies()
    const cartId = cookieStore.get("_medusa_cart_id")?.value
    
    // If no cart ID, return early
    if (!cartId) {
      return NextResponse.json({ 
        success: false, 
        message: "No cart ID found in cookies" 
      })
    }
    
    // Retrieve the cart
    const cart = await retrieveCart()
    
    if (!cart) {
      return NextResponse.json({ 
        success: false, 
        message: "Cart not found" 
      })
    }
    
    // Enrich the line items with product data
    let enrichedCart = { ...cart }
    
    if (cart.items?.length) {
      try {
        const enrichedItems = await enrichLineItems(cart.items, cart.region_id!)
        enrichedCart.items = enrichedItems
      } catch (enrichError) {
        console.error("Error enriching line items:", enrichError)
        // Continue with non-enriched items rather than failing
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      cart: enrichedCart
    })
  } catch (error: any) {
    console.error("Error in cart refresh:", error)
    return NextResponse.json({ 
      success: false, 
      message: error.message 
    }, { status: 500 })
  }
} 