export type UserRole = 'owner' | 'cashier'
export type PaymentMethod = 'cash' | 'qris'
export type TransactionStatus = 'completed' | 'void'
export type StockMovementType = 'sale' | 'restock' | 'adjustment'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  store_id: string
  is_active: boolean
  created_at: string
}

export interface Product {
  id: string
  store_id: string
  name: string
  sku: string | null
  category: string | null
  selling_price: number
  cost_price: number
  stock_qty: number
  min_stock: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  store_id: string
  transaction_code: string
  cashier_id: string
  cashier_name: string
  total_amount: number
  discount: number
  payment_method: PaymentMethod
  payment_amount: number
  change_amount: number
  status: TransactionStatus
  void_reason: string | null
  notes: string | null
  created_at: string
}

export interface TransactionItem {
  id: string
  transaction_id: string
  product_id: string
  product_name: string
  qty: number
  selling_price: number
  cost_price: number
  subtotal: number
}

export interface StockMovement {
  id: string
  store_id: string
  product_id: string
  type: StockMovementType
  qty_change: number
  qty_after: number
  reference_id: string | null
  notes: string | null
  created_at: string
}

export interface Setting {
  id: string
  store_id: string
  key: string
  value: string
  updated_at: string
  updated_by: string
}

export interface Store {
  id: string
  name: string
  address: string | null
  phone: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      stores: { Row: Store; Insert: Omit<Store, 'id' | 'created_at'>; Update: Partial<Store> }
      profiles: { Row: Profile; Insert: Omit<Profile, 'created_at'>; Update: Partial<Profile> }
      products: { Row: Product; Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Product> }
      transactions: { Row: Transaction; Insert: Omit<Transaction, 'id' | 'created_at'>; Update: Partial<Transaction> }
      transaction_items: { Row: TransactionItem; Insert: Omit<TransactionItem, 'id'>; Update: never }
      stock_movements: { Row: StockMovement; Insert: Omit<StockMovement, 'id' | 'created_at'>; Update: never }
      settings: { Row: Setting; Insert: Omit<Setting, 'id' | 'updated_at'>; Update: Partial<Setting> }
    }
  }
}
