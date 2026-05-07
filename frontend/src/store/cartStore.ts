import { create } from 'zustand'

interface CartItem {
  id: number
  product_id: number
  quantity: number
  price: number
  name?: string
  image_url?: string
}

interface CartState {
  items: CartItem[]
  total: number
  setCart: (items: CartItem[], total: number) => void
  clearCart: () => void
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  total: 0,
  setCart: (items: CartItem[], total: number) => set({ items, total }),
  clearCart: () => set({ items: [], total: 0 }),
}))
