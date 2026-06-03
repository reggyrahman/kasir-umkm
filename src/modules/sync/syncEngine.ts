import { supabase } from '@/lib/supabase'
import { localDb } from '@/db/local'
import { useSyncStore } from '@/store/syncStore'

const MAX_RETRY = 3

export async function flushSyncQueue(): Promise<void> {
  const { setSyncing, setPendingCount, setLastSyncAt } = useSyncStore.getState()

  const pending = await localDb.sync_queue
    .where('retry_count').below(MAX_RETRY)
    .toArray()

  if (pending.length === 0) return

  useSyncStore.getState().setSyncing(true)
  setPendingCount(pending.length)

  for (const item of pending) {
    try {
      const payload = JSON.parse(item.payload)

      if (item.operation === 'insert') {
        const { error } = await supabase.from(item.table_name as any).insert(payload)
        if (error) throw error
      } else if (item.operation === 'update') {
        const { error } = await supabase.from(item.table_name as any)
          .update(payload as never)
          .eq('id', item.record_id)
        if (error) throw error
      } else if (item.operation === 'delete') {
        const { error } = await supabase.from(item.table_name as any)
          .delete()
          .eq('id', item.record_id)
        if (error) throw error
      }

      // Sukses: hapus dari queue
      await localDb.sync_queue.delete(item.id!)
    } catch {
      // Gagal: increment retry
      await localDb.sync_queue.update(item.id!, {
        retry_count: item.retry_count + 1
      })
    }
  }

  const remaining = await localDb.sync_queue.count()
  setPendingCount(remaining)
  useSyncStore.getState().setSyncing(false)
  setLastSyncAt(new Date().toISOString())
}

// Jalankan sync saat online
export function initSyncListener() {
  window.addEventListener('online', () => {
    useSyncStore.getState().setOnline(true)
    flushSyncQueue()
  })
  window.addEventListener('offline', () => {
    useSyncStore.getState().setOnline(false)
  })

  // Sync periodik setiap 30 detik kalau online
  setInterval(() => {
    if (navigator.onLine) flushSyncQueue()
  }, 30_000)
}
