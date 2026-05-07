import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api/client'
import { useAuthStore } from '../store/authStore'

interface Product {
  id: number
  name: string
  description?: string
  price: number
  stock: number
  category?: string
  image_url?: string
}

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [product, setProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchProduct()
  }, [id])

  const fetchProduct = async () => {
    try {
      const response = await api.get(`/products/${id}`)
      setProduct(response.data)
    } catch (error) {
      console.error('Failed to fetch product', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddToCart = async () => {
    if (!isAuthenticated()) {
      navigate('/login')
      return
    }

    setAdding(true)
    try {
      await api.post('/cart/items', {
        product_id: product?.id,
        quantity,
      })
      navigate('/cart')
    } catch (error) {
      console.error('Failed to add to cart', error)
      alert('Failed to add item to cart')
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-600 text-lg">Product not found</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="md:flex">
          <div className="md:w-1/2 h-96 bg-gray-200 flex items-center justify-center">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <svg
                className="w-24 h-24 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            )}
          </div>

          <div className="md:w-1/2 p-8">
            <div className="mb-4">
              {product.category && (
                <span className="inline-block px-3 py-1 text-sm bg-gray-100 text-gray-600 rounded-full">
                  {product.category}
                </span>
              )}
            </div>

            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              {product.name}
            </h1>

            <p className="text-gray-600 mb-6">
              {product.description || 'No description available'}
            </p>

            <div className="mb-6">
              <span className="text-4xl font-bold text-indigo-600">
                ${product.price.toFixed(2)}
              </span>
            </div>

            <div className="mb-6">
              <span
                className={`text-lg ${
                  product.stock > 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {product.stock > 0
                  ? `${product.stock} items in stock`
                  : 'Out of stock'}
              </span>
            </div>

            {product.stock > 0 && (
              <div className="flex items-center gap-4 mb-6">
                <label className="text-gray-700">Quantity:</label>
                <div className="flex items-center border rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100"
                  >
                    -
                  </button>
                  <span className="px-4 py-2">{quantity}</span>
                  <button
                    onClick={() =>
                      setQuantity(Math.min(product.stock, quantity + 1))
                    }
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0 || adding}
              className={`w-full py-3 rounded-lg font-semibold transition ${
                product.stock > 0
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {adding ? 'Adding...' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
