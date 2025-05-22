import { NextRequest, NextResponse } from "next/server"
import { sdk } from "@lib/config"
import { cookies } from "next/headers"
import { getRegion } from "@lib/data/regions"

export async function POST(req: NextRequest) {
  try {
    const { variantId, quantity, countryCode } = await req.json()
    
    if (!variantId || !countryCode) {
      return NextResponse.json({ 
        success: false, 
        message: "Missing required fields" 
      }, { status: 400 })
    }
    
    // Get or create cart
    const cookieStore = cookies()
    let cartId = cookieStore.get("_medusa_cart_id")?.value
    
    // Log what cartId we found
    console.log(`Cart ID from cookies: ${cartId || 'none'}`)
    
    const region = await getRegion(countryCode)
    
    if (!region) {
      return NextResponse.json({ 
        success: false, 
        message: `Region not found for country code: ${countryCode}` 
      }, { status: 400 })
    }
    
    // If no cart exists, create one
    if (!cartId) {
      try {
        console.log("Creating new cart with region ID:", region.id)
        const cartResp = await sdk.store.cart.create({ region_id: region.id })
        cartId = cartResp.cart.id
        
        // Set the cart cookie with proper options
        const response = NextResponse.json({ 
          success: true,
          cart: {
            id: cartResp.cart.id,
            created: true,
            items_count: 0
          }
        })
        
        response.cookies.set("_medusa_cart_id", cartId, {
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        })
        
        console.log("Set new cart cookie:", cartId)
        
        // We just created the cart, now we need to add the item in a separate call
        try {
          const lineItemResponse = await sdk.store.cart.createLineItem(
            cartId,
            {
              variant_id: variantId,
              quantity: quantity || 1,
            }
          )
          
          return NextResponse.json({ 
            success: true, 
            cart: {
              id: lineItemResponse.cart.id,
              items_count: lineItemResponse.cart.items?.length || 0,
              created: true,
              cookie_set: true
            }
          }, { headers: response.headers })
        } catch (lineItemError: any) {
          console.error("Error adding item to new cart:", lineItemError)
          return response
        }
      } catch (createError) {
        console.error("Error creating cart:", createError)
        return NextResponse.json({ 
          success: false, 
          message: "Failed to create cart",
          error: createError.message 
        }, { status: 500 })
      }
    }
    
    // For existing carts, add item directly
    try {
      console.log(`Adding item to existing cart ${cartId}:`, { variantId, quantity: quantity || 1 })
      const response = await sdk.store.cart.createLineItem(
        cartId,
        {
          variant_id: variantId,
          quantity: quantity || 1,
        }
      )
      
      return NextResponse.json({ 
        success: true, 
        cart: {
          id: response.cart.id,
          items_count: response.cart.items?.length || 0,
          cookie_exists: true
        }
      })
    } catch (lineItemError: any) {
      console.error("Error adding to cart:", lineItemError)
      
      // If it's a 404 error, the cart may have expired on the server
      if (lineItemError.message?.includes("404") || lineItemError.message?.includes("not found")) {
        console.log("Cart not found on server. Creating a new one.")
        
        // Create a new cart
        const cartResp = await sdk.store.cart.create({ region_id: region.id })
        const newCartId = cartResp.cart.id
        
        // Set the new cart cookie
        const response = NextResponse.json({ 
          success: true,
          cart: {
            id: newCartId,
            recovery: true,
            original_cart_id: cartId,
            items_count: 0
          }
        })
        
        response.cookies.set("_medusa_cart_id", newCartId, {
          maxAge: 60 * 60 * 24 * 7, // 7 days
          path: "/",
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        })
        
        // Add the item to the new cart
        try {
          const lineItemResponse = await sdk.store.cart.createLineItem(
            newCartId,
            {
              variant_id: variantId,
              quantity: quantity || 1,
            }
          )
          
          return NextResponse.json({ 
            success: true, 
            cart: {
              id: lineItemResponse.cart.id,
              items_count: lineItemResponse.cart.items?.length || 0,
              recovery: true,
              cookie_set: true
            }
          }, { headers: response.headers })
        } catch (retryError) {
          console.error("Error adding item to recovered cart:", retryError)
          return response
        }
      }
      
      return NextResponse.json({ 
        success: false, 
        message: "Failed to add item to cart",
        error: lineItemError.message 
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error("Unexpected error in cart/add:", error)
    return NextResponse.json({ 
      success: false, 
      message: "An unexpected error occurred",
      error: error.message 
    }, { status: 500 })
  }
} 