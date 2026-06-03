import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { localDb, addToSyncQueue } from '@/db/local'
import { useStoreId, useProfile, useHasHydrated } from '@/store/authStore'
import { useSyncStore } from '@/store/syncStore'
import { generateId } from '@/lib/utils'
import type { Transaction, TransactionItem, PaymentMethod } from '@/types/database'
import type { CartItem } from '@/store/cartStore'

export interface CheckoutPayload {
  items: CartItem[]
  discount: number
  paymentMethod: PaymentMethod
  paymentAmount: number
}

const sb = supabase as any

export function useTransactions(dateFrom?: string, dateTo?: string) {
  const storeId = useStoreId()
  const hydrated = useHasHydrated()
  return useQuery({
    queryKey: ['transactions', storeId, dateFrom, dateTo],
    queryFn: async () => {
      let query = sb.from('transactions').select('*')
        .eq('store_id', storeId!).order('created_at', { ascending: false }).limit(100)
      if (dateFrom) query = query.gte('created_at', dateFrom)
      if (dateTo) query = query.lte('created_at', dateTo)
      const { data, error } = await query
      if (error) throw error
      return data as Transaction[]
    },
    enabled: hydrated && !!storeId,
  })
}

export function useTransactionItems(transactionId: string | null) {
  return useQuery({
    queryKey: ['transaction_items', transactionId],
    queryFn: async () => {
      const { data, error } = await sb.from('transaction_items').select('*').eq('transaction_id', transactionId!)
      if (error) throw error
      return data as TransactionItem[]
    },
    enabled: !!transactionId,
  })
}

export function useCheckout() {
  const storeId = useStoreId()
  const profile = useProfile()
  const qc = useQueryClient()
  const isOnline = useSyncStore(s => s.isOnline)

  return useMutation({
    mutationFn: async (payload: CheckoutPayload) => {
      const { items, discount, paymentMethod, paymentAmount } = payload
      const totalAmount = items.reduce((s, i) => s + i.subtotal, 0) - discount
      const changeAmount = paymentAmount - totalAmount

      const today = new Date().toISOString().slice(0, 10)
      const todayStart = today + 'T00:00:00.000Z'
      const { count } = await sb.from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId!).gte('created_at', todayStart)
      const seq = String((count || 0) + 1).padStart(4, '0')
      const transactionCode = `INV-${today.replace(/-/g, '')}-${seq}`

      const transaction: Transaction = {
        id: generateId(), store_id: storeId!, transaction_code: transactionCode,
        cashier_id: profile!.id, cashier_name: profile!.full_name,
        total_amount: totalAmount, discount, payment_method: paymentMethod,
        payment_amount: paymentAmount, change_amount: changeAmount,
        status: 'completed', void_reason: null, notes: null,
        created_at: new Date().toISOString(),
      }

      const transactionItems: TransactionItem[] = items.map(item => ({
        id: generateId(), transaction_id: transaction.id,
        product_id: item.product.id, product_name: item.product.name,
        qty: item.qty, selling_price: item.product.selling_price,
        cost_price: item.product.cost_price, subtotal: item.subtotal,
      }))

      // Simpan transaksi & items ke local
      await localDb.transactions.add(transaction as any)
      await localDb.transaction_items.bulkAdd(transactionItems as any)

      // Update stok + catat stock_movements untuk setiap item
      const stockMovements = []
      for (const item of items) {
        const p = await localDb.products.get(item.product.id)
        if (p) {
          const qtyAfter = Math.max(0, p.stock_qty - item.qty)
          await localDb.products.update(item.product.id, {
            stock_qty: qtyAfter, updated_at: new Date().toISOString(),
          } as any)

          // ← CATAT di stock_movements (sale)
          const movement = {
            id: generateId(), store_id: storeId!,
            product_id: item.product.id,
            type: 'sale' as const,
            qty_change: -item.qty,        // negatif = keluar
            qty_after: qtyAfter,
            reference_id: transaction.id, // referensi ke transaksi
            notes: `Penjualan ${transactionCode}`,
            created_at: transaction.created_at,
          }
          await localDb.stock_movements.add(movement as any)
          stockMovements.push(movement)
        }
      }

      if (isOnline) {
        // Sync transaksi
        sb.from('transactions').insert(transaction)
          .then(({ error }: any) => { if (error) console.error('Sync tx failed:', error) })
        sb.from('transaction_items').insert(transactionItems)
          .then(({ error }: any) => { if (error) console.error('Sync items failed:', error) })

        // Sync stock_movements
        if (stockMovements.length > 0) {
          sb.from('stock_movements').insert(stockMovements)
            .then(({ error }: any) => { if (error) console.error('Sync movements failed:', error) })
        }

        // Update stok di Supabase
        for (const item of items) {
          const { data: pd } = await sb.from('products').select('stock_qty').eq('id', item.product.id).single()
          if (pd) {
            sb.from('products').update({
              stock_qty: Math.max(0, (pd as any).stock_qty - item.qty),
              updated_at: new Date().toISOString(),
            }).eq('id', item.product.id)
              .then(({ error }: any) => { if (error) console.error('Sync stock failed:', error) })
          }
        }
      } else {
        await addToSyncQueue('transactions', 'insert', transaction.id, transaction)
        for (const item of transactionItems) {
          await addToSyncQueue('transaction_items', 'insert', item.id, item)
        }
        for (const mov of stockMovements) {
          await addToSyncQueue('stock_movements', 'insert', mov.id, mov)
        }
      }

      return { transaction, stockMovements }
    },
    onSuccess: ({ stockMovements }) => {
      // Update cache produk langsung dari hasil checkout
      qc.setQueriesData(
        { queryKey: ['products'] },
        (old: any) => {
          if (!Array.isArray(old)) return old
          // Buat map perubahan stok
          const changes: Record<string, number> = {}
          stockMovements.forEach((m: any) => {
            changes[m.product_id] = m.qty_after
          })
          return old.map((p: any) =>
            changes[p.id] !== undefined
              ? { ...p, stock_qty: changes[p.id] }
              : p
          )
        }
      )
      // Invalidate transactions & movements untuk fetch data terbaru
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['stock_movements'] })
      qc.invalidateQueries({ queryKey: ['report_today'] })
    },
  })
}

export function useVoidTransaction() {
  const storeId = useStoreId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const updates = { status: 'void', void_reason: reason }
      await localDb.transactions.update(id, updates as any)
      const { error } = await sb.from('transactions').update(updates).eq('id', id).eq('store_id', storeId!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  })
}
