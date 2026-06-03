import { Modal, Badge } from '@/components/ui'
import { useStockMovements } from './useStockMovements'
import { formatNumber, formatDate } from '@/lib/utils'
import { TrendingDown, TrendingUp, SlidersHorizontal, Loader2 } from 'lucide-react'
import type { Product } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  product: Product | null
}

export default function StockHistoryModal({ open, onClose, product }: Props) {
  const { data: movements = [], isLoading } = useStockMovements(product?.id)

  function typeIcon(type: string) {
    if (type === 'sale') return <TrendingDown className="w-4 h-4 text-red-500" />
    if (type === 'restock') return <TrendingUp className="w-4 h-4 text-green-500" />
    return <SlidersHorizontal className="w-4 h-4 text-orange-500" />
  }

  function typeLabel(type: string) {
    if (type === 'sale') return <Badge variant="red">Penjualan</Badge>
    if (type === 'restock') return <Badge variant="green">Restock</Badge>
    return <Badge variant="yellow">Penyesuaian</Badge>
  }

  return (
    <Modal open={open} onClose={onClose} title={`Riwayat Stok — ${product?.name || ''}`} width="max-w-xl">
      <div className="p-5">
        {/* Info stok sekarang */}
        <div className="bg-gray-50 rounded-xl px-4 py-3 flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500">Stok saat ini</span>
          <span className="text-xl font-bold text-gray-900">{formatNumber(product?.stock_qty || 0)}</span>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : movements.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">Belum ada riwayat mutasi stok</p>
        ) : (
          <div className="space-y-2">
            {movements.map((m: any) => (
              <div key={m.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                  {typeIcon(m.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    {typeLabel(m.type)}
                    <span className={`font-bold text-sm ${m.qty_change > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {m.qty_change > 0 ? '+' : ''}{formatNumber(m.qty_change)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-500">{formatDate(m.created_at)}</span>
                    <span className="text-xs text-gray-400">Sisa: {formatNumber(m.qty_after)}</span>
                  </div>
                  {m.notes && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{m.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
