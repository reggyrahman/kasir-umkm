import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { localDb, addToSyncQueue } from '@/db/local'
import { useStoreId, useHasHydrated } from '@/store/authStore'
import { useSyncStore } from '@/store/syncStore'
import { generateId } from '@/lib/utils'
import type { Product } from '@/types/database'

export type ProductInput = Omit<Product, 'id' | 'store_id' | 'created_at' | 'updated_at'>
const sb = supabase as any

export function useProducts(search = '', category = '') {
  const storeId = useStoreId()
  const hydrated = useHasHydrated()
  const isOnline = useSyncStore(s => s.isOnline)
  return useQuery({
    queryKey: ['products', storeId, search, category],
    queryFn: async () => {
      if (isOnline) {
        let query = sb.from('products').select('*')
          .eq('store_id', storeId!).eq('is_active', true).order('name')
        if (search) query = query.ilike('name', `%${search}%`)
        if (category) query = query.eq('category', category)
        const { data, error } = await query
        if (error) throw error
        if (data) await localDb.products.bulkPut(data as Product[])
        return data as Product[]
      } else {
        let items = await localDb.products
          .where('store_id').equals(storeId!).and(p => p.is_active).toArray()
        if (search) { const s = search.toLowerCase(); items = items.filter(p => p.name.toLowerCase().includes(s)) }
        if (category) items = items.filter(p => p.category === category)
        return items.sort((a, b) => a.name.localeCompare(b.name))
      }
    },
    enabled: hydrated && !!storeId,
    staleTime: 1000 * 30,           // 30 detik - stok harus fresh
    refetchOnWindowFocus: true,     // refresh kalau balik ke tab ini
  })
}

export function useCategories() {
  const storeId = useStoreId()
  const hydrated = useHasHydrated()
  return useQuery({
    queryKey: ['categories', storeId],
    queryFn: async () => {
      const { data } = await sb.from('products').select('category')
        .eq('store_id', storeId!).eq('is_active', true).not('category', 'is', null)
      const cats = [...new Set(((data || []) as any[]).map((d: any) => d.category as string))]
      return cats.sort()
    },
    enabled: hydrated && !!storeId,
  })
}

export function useCreateProduct() {
  const storeId = useStoreId()
  const qc = useQueryClient()
  const isOnline = useSyncStore(s => s.isOnline)
  return useMutation({
    mutationFn: async (input: ProductInput) => {
      const product: Product = {
        ...input, id: generateId(), store_id: storeId!,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      await localDb.products.add(product as any)

      // Catat stok awal di stock_movements
      if (product.stock_qty > 0) {
        const openingMovement = {
          id: generateId(), store_id: storeId!,
          product_id: product.id,
          type: 'restock' as const,
          qty_change: product.stock_qty,
          qty_after: product.stock_qty,
          reference_id: null,
          notes: 'Stok awal',
          created_at: product.created_at,
        }
        await localDb.stock_movements.add(openingMovement as any)
        if (isOnline) {
          sb.from('stock_movements').insert(openingMovement)
            .then(({ error }: any) => { if (error) console.error('Sync opening stock failed:', error) })
        } else {
          await addToSyncQueue('stock_movements', 'insert', openingMovement.id, openingMovement)
        }
      }

      if (isOnline) {
        sb.from('products').insert(product)
          .then(({ error }: any) => { if (error) console.error('Sync create failed:', error) })
      } else {
        await addToSyncQueue('products', 'insert', product.id, product)
      }
      return product
    },
    // Tambah ke cache langsung tanpa refetch
    onSuccess: (product) => {
      qc.setQueriesData(
        { queryKey: ['products', storeId] },
        (old: Product[] | undefined) => {
          if (!old) return [product]
          if (old.find(p => p.id === product.id)) return old
          return [...old, product].sort((a, b) => a.name.localeCompare(b.name))
        }
      )
    },
  })
}

export function useUpdateProduct() {
  const storeId = useStoreId()
  const qc = useQueryClient()
  const isOnline = useSyncStore(s => s.isOnline)
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<Product> & { id: string }) => {
      const updates = { ...input, updated_at: new Date().toISOString() }
      await localDb.products.update(id, updates as any)
      if (isOnline) {
        sb.from('products').update(updates).eq('id', id).eq('store_id', storeId!)
          .then(({ error }: any) => { if (error) console.error('Sync update failed:', error) })
      } else {
        await addToSyncQueue('products', 'update', id, updates)
      }
      return { id, ...updates }
    },
    // Update cache langsung
    onSuccess: (updated) => {
      qc.setQueriesData(
        { queryKey: ['products', storeId] },
        (old: Product[] | undefined) => {
          if (!old) return old
          return old.map(p => p.id === updated.id ? { ...p, ...updated } : p)
        }
      )
    },
  })
}

export function useDeleteProduct() {
  const storeId = useStoreId()
  const qc = useQueryClient()
  const isOnline = useSyncStore(s => s.isOnline)
  return useMutation({
    mutationFn: async (id: string) => {
      const updates = { is_active: false, updated_at: new Date().toISOString() }
      await localDb.products.update(id, updates as any)
      if (isOnline) {
        sb.from('products').update(updates).eq('id', id).eq('store_id', storeId!)
          .then(({ error }: any) => { if (error) console.error('Sync delete failed:', error) })
      } else {
        await addToSyncQueue('products', 'update', id, updates)
      }
      return id
    },
    // Hapus dari cache langsung
    onSuccess: (id) => {
      qc.setQueriesData(
        { queryKey: ['products', storeId] },
        (old: Product[] | undefined) => {
          if (!old) return old
          return old.filter(p => p.id !== id)
        }
      )
    },
  })
}
