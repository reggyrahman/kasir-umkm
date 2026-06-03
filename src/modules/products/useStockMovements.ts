import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStoreId, useHasHydrated } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { generateId } from '@/lib/utils'
import { localDb } from '@/db/local'
import { useSyncStore } from '@/store/syncStore'
import type { Product } from '@/types/database'

const sb = supabase as any

export function useStockMovements(productId?: string) {
  const storeId = useStoreId()
  const hydrated = useHasHydrated()
  return useQuery({
    queryKey: ['stock_movements', storeId, productId],
    queryFn: async () => {
      let query = sb
        .from('stock_movements')
        .select('*')
        .eq('store_id', storeId!)
        .order('created_at', { ascending: false })
        .limit(100)
      if (productId) query = query.eq('product_id', productId)
      const { data, error } = await query
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: hydrated && !!storeId,
  })
}

export function useRestock() {
  const storeId = useStoreId()
  const qc = useQueryClient()
  const isOnline = useSyncStore(s => s.isOnline)

  return useMutation({
    mutationFn: async ({ productId, qty, notes }: { productId: string; qty: number; notes?: string }) => {
      const product = await localDb.products.get(productId)
      if (!product) throw new Error('Barang tidak ditemukan')
      const qtyAfter = product.stock_qty + qty

      // Update local
      await localDb.products.update(productId, {
        stock_qty: qtyAfter, updated_at: new Date().toISOString(),
      } as any)

      const movement = {
        id: generateId(), store_id: storeId!, product_id: productId,
        type: 'restock' as const, qty_change: qty, qty_after: qtyAfter,
        reference_id: null, notes: notes || null,
        created_at: new Date().toISOString(),
      }
      await localDb.stock_movements.add(movement as any)

      // Background sync
      if (isOnline) {
        sb.from('products').update({ stock_qty: qtyAfter, updated_at: new Date().toISOString() })
          .eq('id', productId).eq('store_id', storeId!)
          .then(({ error }: any) => { if (error) console.error('Sync restock failed:', error) })
        sb.from('stock_movements').insert(movement)
          .then(({ error }: any) => { if (error) console.error('Sync movement failed:', error) })
      }

      return { productId, qtyAfter, movement }
    },

    // Update cache langsung — TANPA invalidate/refetch
    onSuccess: ({ productId, qtyAfter }) => {
      // Update semua cache yang mengandung produk ini
      qc.setQueriesData(
        { queryKey: ['products', storeId] },
        (old: Product[] | undefined) => {
          if (!old) return old
          return old.map(p =>
            p.id === productId ? { ...p, stock_qty: qtyAfter, updated_at: new Date().toISOString() } : p
          )
        }
      )
      // Update laporan stok juga langsung
      qc.setQueriesData(
        { queryKey: ['report_stock', storeId] },
        (old: any[] | undefined) => {
          if (!old) return old
          return old.map(p =>
            p.id === productId ? { ...p, stock_qty: qtyAfter } : p
          )
        }
      )
    },
  })
}

export function useAdjustStock() {
  const storeId = useStoreId()
  const qc = useQueryClient()
  const isOnline = useSyncStore(s => s.isOnline)

  return useMutation({
    mutationFn: async ({ productId, newQty, notes }: { productId: string; newQty: number; notes?: string }) => {
      const product = await localDb.products.get(productId)
      if (!product) throw new Error('Barang tidak ditemukan')
      const qtyChange = newQty - product.stock_qty

      await localDb.products.update(productId, {
        stock_qty: newQty, updated_at: new Date().toISOString(),
      } as any)

      const movement = {
        id: generateId(), store_id: storeId!, product_id: productId,
        type: 'adjustment' as const, qty_change: qtyChange, qty_after: newQty,
        reference_id: null, notes: notes || 'Penyesuaian stok manual',
        created_at: new Date().toISOString(),
      }
      await localDb.stock_movements.add(movement as any)

      if (isOnline) {
        sb.from('products').update({ stock_qty: newQty, updated_at: new Date().toISOString() })
          .eq('id', productId).eq('store_id', storeId!)
          .then(({ error }: any) => { if (error) console.error('Sync adjust failed:', error) })
        sb.from('stock_movements').insert(movement)
          .then(({ error }: any) => { if (error) console.error('Sync movement failed:', error) })
      }

      return { productId, newQty }
    },

    onSuccess: ({ productId, newQty }) => {
      qc.setQueriesData(
        { queryKey: ['products', storeId] },
        (old: Product[] | undefined) => {
          if (!old) return old
          return old.map(p =>
            p.id === productId ? { ...p, stock_qty: newQty, updated_at: new Date().toISOString() } : p
          )
        }
      )
      qc.setQueriesData(
        { queryKey: ['report_stock', storeId] },
        (old: any[] | undefined) => {
          if (!old) return old
          return old.map(p => p.id === productId ? { ...p, stock_qty: newQty } : p)
        }
      )
    },
  })
}
