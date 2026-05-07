import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCartStore } from '../store/cartStore'

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuthStore()
  const { items } = useCartStore()
  const cartCount = items.reduce((acc, item) => acc + item.quantity, 0)

  return (
    <nav className="bg-white shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="text-2xl font-bold text-indigo-600">
            E-Shop
          </Link>

          <div className="flex items-center space-x-8">
            <Link
              to="/products"
              className="text-gray-700 hover:text-indigo-600 transition"
            >
              Products
            </Link>

            <Link to="/cart" className="relative text-gray-700 hover:text-indigo-600 transition">
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
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>

            {isAuthenticated() ? (
              <div className="flex items-center space-x-4">
                <Link
                  to="/orders"
                  className="text-gray-700 hover:text-indigo-600 transition"
                >
                  Orders
                </Link>
                <span className="text-gray-600">Hi, {user?.username}</span>
                <button
                  onClick={logout}
                  className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg transition"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to="/login"
                  className="text-gray-700 hover:text-indigo-600 transition"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
