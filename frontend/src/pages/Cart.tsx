import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'

interface CartItem {
  id: number
  product_id: number
  quantity: number
  price: number
}

export default function Cart() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const { items, total, setCart, clearCart } = useCartStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login')
      return
    }
    fetchCart()
  }, [isAuthenticated])

  const fetchCart = async () => {
    try {
      const response = await api.get('/cart/')
      setCart(response.data.items, response.data.total)
    } catch (error) {
      console.error('Failed to fetch cart', error)
    } finally {
      setLoading(false)
    }
  }

  const updateQuantity = async (itemId: number, quantity: number) => {
    try {
      if (quantity <= 0) {
        await api.delete(`/cart/items/${itemId}`)
      } else {
        await api.put(`/cart/items/${itemId}`, { quantity })
      }
      fetchCart()
    } catch (error) {
      console.error('Failed to update cart', error)
    }
  }

  const removeItem = async (itemId: number) => {
    try {
      await api.delete(`/cart/items/${itemId}`)
      fetchCart()
    } catch (error) {
      console.error('Failed to remove item', error)
    }
  }

  const handleClearCart = async () => {
    try {
      await api.delete('/cart/')
      clearCart()
    } catch (error) {
      console.error('Failed to clear cart', error)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <svg
          className="w-24 h-24 text-gray-300 mx-auto mb-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">
          Your cart is empty
        </h2>
        <p className="text-gray-600 mb-8">
          Looks like you haven't added any items to your cart yet.
        </p>
        <Link
          to="/products"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-lg transition"
        >
          Start Shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Shopping Cart</h1>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="divide-y">
          {items.map((item: CartItem) => (
            <div key={item.id} className="p-6 flex items-center gap-6">
              <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-10 h-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Product #{item.product_id}
                </h3>
                <p className="text-indigo-600 font-bold">
                  ${item.price.toFixed(2)}
                </p>
              </div>

              <div className="flex items-center border rounded-lg">
                <button
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-100"
                >
                  -
                </button>
                <span className="px-4 py-2">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="px-3 py-2 text-gray-600 hover:bg-gray-100"
                >
                  +
                </button>
              </div>

              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">
                  ${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>

              <button
                onClick={() => removeItem(item.id)}
                className="text-red-500 hover:text-red-700"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>

        <div className="bg-gray-50 p-6">
          <div className="flex justify-between items-center mb-6">
            <span className="text-xl font-semibold text-gray-900">Total:</span>
            <span className="text-2xl font-bold text-indigo-600">
              ${total.toFixed(2)}
            </span>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleClearCart}
              className="flex-1 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition"
            >
              Clear Cart
            </button>
            <Link
              to="/checkout"
              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-center transition"
            >
              Proceed to Checkout
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
