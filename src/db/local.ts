import Dexie, { type Table } from 'dexie'
import type {
  Product, Transaction, TransactionItem,
  StockMovement, Setting, Profile
} from '@/types/database'

// Sync queue untuk operasi yang belum tersync ke Supabase
export interface SyncQueueItem {
  id?: number
  table_name: string
  operation: 'insert' | 'update' | 'delete'
  record_id: string
  payload: string // JSON string
  created_at: string
  retry_count: number
}

export class KasirDatabase extends Dexie {
  products!: Table<Product>
  transactions!: Table<Transaction>
  transaction_items!: Table<TransactionItem>
  stock_movements!: Table<StockMovement>
  settings!: Table<Setting>
  profiles!: Table<Profile>
  sync_queue!: Table<SyncQueueItem>

  constructor() {
    super('kasir-umkm-db')

    this.version(2).stores({
      products:          'id, store_id, name, sku, category, is_active, updated_at',
      transactions:      'id, store_id, transaction_code, cashier_id, status, created_at',
      transaction_items: 'id, transaction_id, product_id',
      stock_movements:   'id, store_id, product_id, type, created_at',
      settings:          'id, store_id, key',
      profiles:          'id, store_id, role',
      sync_queue:        '++id, table_name, operation, record_id, retry_count, created_at',
    })
  }
}

export const localDb = new KasirDatabase()

// Helper: tambahkan ke sync queue
export async function addToSyncQueue(
  table_name: string,
  operation: 'insert' | 'update' | 'delete',
  record_id: string,
  payload: object
) {
  await localDb.sync_queue.add({
    table_name,
    operation,
    record_id,
    payload: JSON.stringify(payload),
    created_at: new Date().toISOString(),
    retry_count: 0,
  })
}
