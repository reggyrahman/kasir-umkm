import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useStoreId, useHasHydrated } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

const sb = supabase as any

export function useSettings() {
  const storeId = useStoreId()
  const hydrated = useHasHydrated()
  return useQuery({
    queryKey: ['settings', storeId],
    queryFn: async () => {
      const { data, error } = await sb.from('settings').select('*').eq('store_id', storeId!)
      if (error) throw error
      const map: Record<string, string> = {} as Record<string, string>
      ;((data || []) as any[]).forEach((s: any) => { map[s.key] = s.value })
      return map
    },
    enabled: hydrated && !!storeId,
    staleTime: 1000 * 60 * 10,
  })
}

export function useUpdateSetting() {
  const storeId = useStoreId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await sb.from('settings')
        .upsert({ store_id: storeId!, key, value, updated_at: new Date().toISOString() },
          { onConflict: 'store_id,key' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useUpdateSettings() {
  const storeId = useStoreId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      const rows = Object.entries(settings).map(([key, value]) => ({
        store_id: storeId!, key, value, updated_at: new Date().toISOString(),
      }))
      const { error } = await sb.from('settings').upsert(rows, { onConflict: 'store_id,key' })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}
