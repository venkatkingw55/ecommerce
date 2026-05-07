import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useCartStore } from '../store/cartStore'

export default function Checkout() {
  const navigate = useNavigate()
  const { total, clearCart } = useCartStore()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    shipping_address: '',
    payment_method: 'card',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await api.post('/payments/checkout', formData)
      clearCart()
      alert('Order placed successfully!')
      navigate('/orders')
    } catch (error) {
      console.error('Checkout failed', error)
      alert('Failed to place order. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Shipping Address
          </h2>
          <textarea
            value={formData.shipping_address}
            onChange={(e) =>
              setFormData({ ...formData, shipping_address: e.target.value })
            }
            required
            rows={4}
            placeholder="Enter your full shipping address..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Payment Method
          </h2>
          <div className="space-y-3">
            <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="payment_method"
                value="card"
                checked={formData.payment_method === 'card'}
                onChange={(e) =>
                  setFormData({ ...formData, payment_method: e.target.value })
                }
                className="w-5 h-5 text-indigo-600"
              />
              <span className="ml-3 font-medium">Credit/Debit Card</span>
            </label>
            <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="payment_method"
                value="paypal"
                checked={formData.payment_method === 'paypal'}
                onChange={(e) =>
                  setFormData({ ...formData, payment_method: e.target.value })
                }
                className="w-5 h-5 text-indigo-600"
              />
              <span className="ml-3 font-medium">PayPal</span>
            </label>
            <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="payment_method"
                value="cod"
                checked={formData.payment_method === 'cod'}
                onChange={(e) =>
                  setFormData({ ...formData, payment_method: e.target.value })
                }
                className="w-5 h-5 text-indigo-600"
              />
              <span className="ml-3 font-medium">Cash on Delivery</span>
            </label>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Order Summary
          </h2>
          <div className="flex justify-between items-center text-lg">
            <span className="text-gray-600">Total Amount:</span>
            <span className="text-2xl font-bold text-indigo-600">
              ${total.toFixed(2)}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !formData.shipping_address}
          className={`w-full py-4 rounded-lg font-semibold text-lg transition ${
            loading || !formData.shipping_address
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {loading ? 'Processing...' : 'Place Order'}
        </button>
      </form>
    </div>
  )
}
