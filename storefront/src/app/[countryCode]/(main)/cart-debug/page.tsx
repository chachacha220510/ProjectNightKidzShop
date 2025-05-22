"use client"

import { Button } from "@medusajs/ui"
import { useEffect, useState } from "react"

interface DebugResponse {
  status?: string
  success?: boolean
  message?: string
  cart?: any
  error?: string
  stage?: string
  [key: string]: any
}

export default function CartDebugPage() {
  const [cartInfo, setCartInfo] = useState<DebugResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [testResult, setTestResult] = useState<DebugResponse | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  // Fetch cart information on page load
  useEffect(() => {
    fetchCartInfo()
  }, [])

  const fetchCartInfo = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/cart/debug")
      const data = await response.json()
      setCartInfo(data)
    } catch (error) {
      console.error("Error fetching cart info:", error)
      setCartInfo({ error: error.message })
    } finally {
      setLoading(false)
    }
  }

  const runCartTest = async () => {
    setTestLoading(true)
    try {
      const response = await fetch("/api/test-cart")
      const data = await response.json()
      setTestResult(data)
      // Refresh cart info after test
      fetchCartInfo()
    } catch (error) {
      console.error("Error running cart test:", error)
      setTestResult({ error: error.message })
    } finally {
      setTestLoading(false)
    }
  }

  const clearCartCookie = () => {
    document.cookie = "_medusa_cart_id=; Max-Age=-1; path=/; domain=" + window.location.hostname
    alert("Cart cookie cleared. Refreshing page...")
    window.location.reload()
  }

  return (
    <div className="py-12 max-w-4xl mx-auto">
      <div className="content-container">
        <h1 className="text-2xl font-bold mb-8">Cart Debugging Tools</h1>

        <div className="bg-white p-6 rounded shadow mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Current Cart Information</h2>
            <Button 
              variant="secondary" 
              onClick={fetchCartInfo} 
              disabled={loading}
              className="ml-4"
            >
              {loading ? "Loading..." : "Refresh"}
            </Button>
          </div>

          {cartInfo && (
            <div className="mt-4">
              <div className="mb-4">
                <h3 className="font-medium mb-2">Status: <span className={cartInfo.status === "success" ? "text-green-600" : "text-red-600"}>{cartInfo.status || "Unknown"}</span></h3>
                {cartInfo.message && <p className="text-gray-600">{cartInfo.message}</p>}
              </div>

              {cartInfo.cart && (
                <div className="mb-4">
                  <h3 className="font-medium mb-2">Cart Details:</h3>
                  <div className="bg-gray-50 p-4 rounded">
                    <p><strong>ID:</strong> {cartInfo.cart.id}</p>
                    <p><strong>Items:</strong> {cartInfo.cart.items_count}</p>
                    <p><strong>Region:</strong> {cartInfo.cart.region_id}</p>
                    <p><strong>Created:</strong> {new Date(cartInfo.cart.created_at).toLocaleString()}</p>
                    <p><strong>Updated:</strong> {new Date(cartInfo.cart.updated_at).toLocaleString()}</p>
                    {cartInfo.cart.items && cartInfo.cart.items.length > 0 && (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2">Items:</h4>
                        <ul className="list-disc pl-5">
                          {cartInfo.cart.items.map((item: any) => (
                            <li key={item.id} className="mb-2">
                              {item.title} (Variant: {item.variant_id?.substring(0, 8)}...) - Qty: {item.quantity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {cartInfo.cookies && (
                <div className="mb-4">
                  <h3 className="font-medium mb-2">Cookies:</h3>
                  <div className="bg-gray-50 p-4 rounded">
                    <ul className="list-disc pl-5">
                      {cartInfo.cookies.map((cookie: any) => (
                        <li key={cookie.name}>
                          <strong>{cookie.name}:</strong> {cookie.value}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {cartInfo.error && (
                <div className="mb-4 text-red-600">
                  <h3 className="font-medium mb-2">Error:</h3>
                  <p>{cartInfo.error}</p>
                </div>
              )}
            </div>
          )}

          {!cartInfo && !loading && (
            <p className="text-gray-600">No cart information available.</p>
          )}
        </div>

        <div className="bg-white p-6 rounded shadow mb-8">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Button onClick={runCartTest} disabled={testLoading} className="w-full">
                {testLoading ? "Testing..." : "Run Cart Test"}
              </Button>
              <p className="text-sm text-gray-600 mt-2">
                Creates a test cart, adds a product, and sets a cookie
              </p>
            </div>

            <div>
              <Button onClick={clearCartCookie} variant="secondary" className="w-full">
                Clear Cart Cookie
              </Button>
              <p className="text-sm text-gray-600 mt-2">
                Removes the _medusa_cart_id cookie from your browser
              </p>
            </div>
          </div>

          {testResult && (
            <div className="mt-6 p-4 bg-gray-50 rounded">
              <h3 className="font-medium mb-2">Test Result:</h3>
              {testResult.success ? (
                <div className="text-green-600">
                  <p className="mb-2">✅ {testResult.message}</p>
                  {testResult.cart && (
                    <div className="mt-2">
                      <p><strong>New Cart ID:</strong> {testResult.cart.id}</p>
                      <p><strong>Items Count:</strong> {testResult.cart.items_count}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-red-600">
                  <p className="mb-2">❌ Failed at stage: {testResult.stage}</p>
                  <p><strong>Error:</strong> {testResult.error}</p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="text-sm text-gray-500 mt-4">
          <p>This page is for development and debugging purposes only. Use it to diagnose cart-related issues in your Medusa storefront.</p>
        </div>
      </div>
    </div>
  )
} 