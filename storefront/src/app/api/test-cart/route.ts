import { NextRequest, NextResponse } from "next/server"
import { sdk } from "@lib/config"
import { cookies } from "next/headers"
import { getRegion } from "@lib/data/regions"

/**
 * Test endpoint for diagnosing cart issues
 * Tests all aspects of cart functionality in one sequence
 */
export async function GET(req: NextRequest) {
  try {
    // Step 1: Check environment configuration
    const config = {
      backend_url: process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "Not configured",
      publishable_key: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ? "Configured" : "Not configured",
      default_region: process.env.NEXT_PUBLIC_DEFAULT_REGION || "Not configured"
    }
    
    // Step 2: Get region for US (or default region)
    const regionCode = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"
    let region
    
    try {
      region = await getRegion(regionCode)
    } catch (regionError) {
      return NextResponse.json({
        success: false,
        stage: "region_check",
        error: regionError.message,
        config
      }, { status: 500 })
    }
    
    if (!region) {
      return NextResponse.json({
        success: false,
        stage: "region_check",
        error: `Region not found for code: ${regionCode}`,
        config
      }, { status: 400 })
    }
    
    // Step 3: Clear any existing cart cookies
    const cookieStore = cookies()
    const existingCartId = cookieStore.get("_medusa_cart_id")?.value
    
    // Step 4: Create a cart
    let cart
    let cartId
    
    try {
      const cartResponse = await sdk.store.cart.create({ 
        region_id: region.id 
      })
      
      cart = cartResponse.cart
      cartId = cart.id
    } catch (cartError) {
      return NextResponse.json({
        success: false,
        stage: "cart_creation",
        error: cartError.message,
        region,
        existing_cart_id: existingCartId,
        config
      }, { status: 500 })
    }
    
    // Step 5: Get all products to find one to add to cart
    let product
    let variant
    
    try {
      const productsResponse = await sdk.store.product.list()
      
      if (!productsResponse.products.length) {
        return NextResponse.json({
          success: false,
          stage: "product_fetch",
          error: "No products available in the store",
          cart,
          region,
          config
        }, { status: 400 })
      }
      
      // Get first product with variants
      product = productsResponse.products.find(p => p.variants?.length > 0)
      
      if (!product) {
        return NextResponse.json({
          success: false,
          stage: "variant_check",
          error: "No products with variants found",
          products_count: productsResponse.products.length,
          cart,
          region,
          config
        }, { status: 400 })
      }
      
      variant = product.variants[0]
    } catch (productError) {
      return NextResponse.json({
        success: false,
        stage: "product_fetch",
        error: productError.message,
        cart,
        region,
        config
      }, { status: 500 })
    }
    
    // Step 6: Add item to cart
    try {
      const lineItemResponse = await sdk.store.cart.createLineItem(
        cartId,
        {
          variant_id: variant.id,
          quantity: 1
        }
      )
      
      cart = lineItemResponse.cart
    } catch (lineItemError) {
      return NextResponse.json({
        success: false,
        stage: "add_to_cart",
        error: lineItemError.message,
        cart_id: cartId,
        variant_id: variant.id,
        region,
        config
      }, { status: 500 })
    }
    
    // Step 7: Set cart cookie in response
    const response = NextResponse.json({
      success: true,
      message: "Cart test completed successfully",
      cart: {
        id: cart.id,
        items: cart.items.map(item => ({
          id: item.id,
          title: item.title,
          variant_id: item.variant_id,
          quantity: item.quantity
        })),
        region_id: cart.region_id,
        items_count: cart.items.length
      },
      product: {
        id: product.id,
        title: product.title,
        variant_id: variant.id
      },
      region: {
        id: region.id,
        name: region.name,
        countries: region.countries?.map(c => c.display_name)
      },
      config
    })
    
    // Set the cart cookie
    response.cookies.set("_medusa_cart_id", cartId, {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
    
    return response
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack?.split("\n").slice(0, 3)
    }, { status: 500 })
  }
} 