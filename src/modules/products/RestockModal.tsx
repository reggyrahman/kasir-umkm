import { useState } from 'react'
import { Modal, Button } from '@/components/ui'
import { useRestock, useAdjustStock } from './useStockMovements'
import { formatNumber, parseRupiahInput } from '@/lib/utils'
import { PackagePlus, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Product } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  product: Product | null
}

type Mode = 'restock' | 'adjustment'

export default function RestockModal({ open, onClose, product }: Props) {
  const [mode, setMode] = useState<Mode>('restock')
  const [qty, setQty] = useState('')
  const [newQty, setNewQty] = useState('')
  const [notes, setNotes] = useState('')

  const restock = useRestock()
  const adjust = useAdjustStock()

  function handleClose() {
    setQty(''); setNewQty(''); setNotes(''); setMode('restock')
    onClose()
  }

  async function handleSubmit() {
    if (!product) return

    if (mode === 'restock') {
      const qtyNum = parseInt(qty) || 0
      if (qtyNum <= 0) return toast.error('Jumlah restock harus lebih dari 0')
      try {
        await restock.mutateAsync({ productId: product.id, qty: qtyNum, notes })
        toast.success(`Stok +${qtyNum} berhasil dicatat`)
        handleClose()
      } catch (e: any) {
        toast.error(e.message || 'Gagal restock')
      }
    } else {
      const qtyNum = parseInt(newQty)
      if (isNaN(qtyNum) || qtyNum < 0) return toast.error('Stok baru tidak valid')
      if (!notes.trim()) return toast.error('Catatan wajib diisi untuk penyesuaian')
      try {
        await adjust.mutateAsync({ productId: product.id, newQty: qtyNum, notes })
        toast.success('Penyesuaian stok berhasil dicatat')
        handleClose()
      } catch (e: any) {
        toast.error(e.message || 'Gagal penyesuaian')
      }
    }
  }

  const loading = restock.isPending || adjust.isPending
  const diff = mode === 'restock'
    ? (parseInt(qty) || 0)
    : (parseInt(newQty) || 0) - (product?.stock_qty || 0)

  return (
    <Modal open={open} onClose={handleClose} title={`Kelola Stok — ${product?.name || ''}`}>
      <div className="p-5 space-y-4">
        {/* Info stok sekarang */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center">
          <span className="text-sm text-gray-500">Stok saat ini</span>
          <span className="text-xl font-bold text-gray-900">{formatNumber(product?.stock_qty || 0)}</span>
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setMode('restock')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
              ${mode === 'restock' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            <PackagePlus className="w-4 h-4" />
            Restock
          </button>
          <button onClick={() => setMode('adjustment')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all
              ${mode === 'adjustment' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            <SlidersHorizontal className="w-4 h-4" />
            Penyesuaian
          </button>
        </div>

        {mode === 'restock' ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">Masukkan jumlah barang yang baru masuk/diterima.</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Jumlah Masuk</label>
              <input
                type="number" min="1"
                value={qty}
                onChange={e => setQty(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                autoFocus
              />
            </div>
            {(parseInt(qty) || 0) > 0 && (
              <div className="bg-green-50 text-green-700 text-sm px-4 py-2.5 rounded-xl flex justify-between">
                <span>Stok setelah restock</span>
                <span className="font-bold">{formatNumber((product?.stock_qty || 0) + (parseInt(qty) || 0))}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-lg">
              Penyesuaian untuk koreksi stok fisik (misal: setelah stock opname). Semua perubahan tercatat di riwayat.
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Stok Baru (aktual)</label>
              <input
                type="number" min="0"
                value={newQty}
                onChange={e => setNewQty(e.target.value)}
                placeholder={String(product?.stock_qty || 0)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm
                           focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
                autoFocus
              />
            </div>
            {newQty !== '' && !isNaN(parseInt(newQty)) && (
              <div className={`text-sm px-4 py-2.5 rounded-xl flex justify-between
                ${diff > 0 ? 'bg-green-50 text-green-700' : diff < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-600'}`}>
                <span>Selisih</span>
                <span className="font-bold">{diff > 0 ? '+' : ''}{formatNumber(diff)}</span>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Catatan {mode === 'adjustment' ? '*' : '(opsional)'}
          </label>
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={mode === 'restock' ? 'Contoh: Dari supplier CV Maju, faktur #123' : 'Alasan penyesuaian...'}
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={handleClose} disabled={loading}>Batal</Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            loading={loading}
            variant={mode === 'adjustment' ? 'secondary' : 'primary'}
          >
            {mode === 'restock' ? 'Catat Restock' : 'Simpan Penyesuaian'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
