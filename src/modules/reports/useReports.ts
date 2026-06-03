import { useQuery } from '@tanstack/react-query'
import { useStoreId, useHasHydrated } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

const sb = supabase as any

export function useDailyRevenue(days = 7) {
  const storeId = useStoreId()
  const hydrated = useHasHydrated()
  return useQuery({
    queryKey: ['report_revenue', storeId, days],
    queryFn: async () => {
      const from = new Date()
      from.setDate(from.getDate() - (days - 1))
      from.setHours(0, 0, 0, 0)
      const { data, error } = await sb.from('transactions')
        .select('created_at, total_amount, payment_method')
        .eq('store_id', storeId!).eq('status', 'completed')
        .gte('created_at', from.toISOString()).order('created_at', { ascending: true })
      if (error) throw error
      const map: Record<string, { date: string; revenue: number; count: number }> = {} as any
      ;((data || []) as any[]).forEach((tx: any) => {
        const date = new Date(tx.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', timeZone: 'Asia/Jakarta' })
        if (!map[date]) map[date] = { date, revenue: 0, count: 0 }
        map[date].revenue += tx.total_amount
        map[date].count += 1
      })
      return Object.values(map)
    },
    enabled: hydrated && !!storeId,
  })
}

export function useTodaySummary() {
  const storeId = useStoreId()
  const hydrated = useHasHydrated()
  return useQuery({
    queryKey: ['report_today', storeId],
    queryFn: async () => {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)
      const { data: txData, error: txError } = await sb.from('transactions')
        .select('id, total_amount').eq('store_id', storeId!).eq('status', 'completed')
        .gte('created_at', todayStart.toISOString())
      if (txError) throw txError
      const txList = (txData || []) as any[]
      const revenue = txList.reduce((s: number, t: any) => s + t.total_amount, 0)
      const txCount = txList.length
      if (txCount === 0) return { revenue: 0, grossProfit: 0, txCount: 0, itemCount: 0 }
      const txIds = txList.map((t: any) => t.id)
      const { data: itemData, error: itemError } = await sb.from('transaction_items')
        .select('selling_price, cost_price, qty').in('transaction_id', txIds)
      if (itemError) throw itemError
      let grossProfit = 0, itemCount = 0
      ;((itemData || []) as any[]).forEach((item: any) => {
        grossProfit += (item.selling_price - item.cost_price) * item.qty
        itemCount += item.qty
      })
      return { revenue, grossProfit, txCount, itemCount }
    },
    enabled: hydrated && !!storeId,
    refetchInterval: 30_000,
  })
}

export function useGrossProfitReport(dateFrom: string, dateTo: string) {
  const storeId = useStoreId()
  const hydrated = useHasHydrated()
  return useQuery({
    queryKey: ['report_profit', storeId, dateFrom, dateTo],
    queryFn: async () => {
      const { data: txData, error: txError } = await sb.from('transactions')
        .select('id').eq('store_id', storeId!).eq('status', 'completed')
        .gte('created_at', dateFrom).lte('created_at', dateTo)
      if (txError) throw txError
      const txList = (txData || []) as any[]
      if (txList.length === 0) return []
      const txIds = txList.map((t: any) => t.id)
      const { data: itemData, error: itemError } = await sb.from('transaction_items')
        .select('product_name, qty, selling_price, cost_price, subtotal').in('transaction_id', txIds)
      if (itemError) throw itemError
      const map: Record<string, { name: string; qty: number; revenue: number; cogs: number; profit: number }> = {} as any
      ;((itemData || []) as any[]).forEach((item: any) => {
        const name = item.product_name
        if (!map[name]) map[name] = { name, qty: 0, revenue: 0, cogs: 0, profit: 0 }
        map[name].qty += item.qty
        map[name].revenue += item.subtotal
        map[name].cogs += item.cost_price * item.qty
        map[name].profit += (item.selling_price - item.cost_price) * item.qty
      })
      return Object.values(map).sort((a, b) => b.profit - a.profit)
    },
    enabled: hydrated && !!storeId && !!dateFrom && !!dateTo,
  })
}

export function useStockReport() {
  const storeId = useStoreId()
  const hydrated = useHasHydrated()
  return useQuery({
    queryKey: ['report_stock', storeId],
    queryFn: async () => {
      const { data, error } = await sb.from('products')
        .select('id, name, category, stock_qty, min_stock, selling_price, cost_price')
        .eq('store_id', storeId!).eq('is_active', true).order('stock_qty', { ascending: true })
      if (error) throw error
      return (data || []) as any[]
    },
    enabled: hydrated && !!storeId,
  })
}
