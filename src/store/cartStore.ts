import { create } from 'zustand'
import type { Product } from '@/types/database'

export interface CartItem {
  product: Product
  qty: number
  subtotal: number
}

interface CartState {
  items: CartItem[]
  discount: number
  addItem: (product: Product) => void
  removeItem: (productId: string) => void
  updateQty: (productId: string, qty: number) => void
  setDiscount: (discount: number) => void
  clearCart: () => void
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discount: 0,

  addItem: (product) => {
    const items = get().items
    const existing = items.find(i => i.product.id === product.id)
    if (existing) {
      set({
        items: items.map(i =>
          i.product.id === product.id
            ? { ...i, qty: i.qty + 1, subtotal: (i.qty + 1) * i.product.selling_price }
            : i
        )
      })
    } else {
      set({ items: [...items, { product, qty: 1, subtotal: product.selling_price }] })
    }
  },

  removeItem: (productId) => {
    set({ items: get().items.filter(i => i.product.id !== productId) })
  },

  updateQty: (productId, qty) => {
    if (qty <= 0) {
      get().removeItem(productId)
      return
    }
    set({
      items: get().items.map(i =>
        i.product.id === productId
          ? { ...i, qty, subtotal: qty * i.product.selling_price }
          : i
      )
    })
  },

  setDiscount: (discount) => set({ discount }),
  clearCart: () => set({ items: [], discount: 0 }),
}))

// Selectors
export const useCartTotal = () => useCartStore(s =>
  s.items.reduce((sum, i) => sum + i.subtotal, 0) - s.discount
)
export const useCartItemCount = () => useCartStore(s =>
  s.items.reduce((sum, i) => sum + i.qty, 0)
)
