import { useState } from 'react'
import { ClipboardList, Search, Eye, XCircle, Download } from 'lucide-react'
import { useTransactions, useVoidTransaction, useTransactionItems } from './useTransactions'
import { useSettings } from '@/modules/settings/useSettings'
import { Badge, Card, EmptyState, Modal, Button, PageHeader } from '@/components/ui'
import { formatRupiah, formatDate } from '@/lib/utils'
import { exportTransaksi } from '@/lib/exportExcel'
import toast from 'react-hot-toast'
import type { Transaction } from '@/types/database'

export default function TransactionsPage() {
  const [search, setSearch] = useState('')
  const [detailTx, setDetailTx] = useState<Transaction | null>(null)
  const [voidTx, setVoidTx] = useState<Transaction | null>(null)
  const [voidReason, setVoidReason] = useState('')

  const { data: transactions = [], isLoading } = useTransactions()
  const { data: detailItems = [] } = useTransactionItems(detailTx?.id ?? null)
  const { data: settings } = useSettings()
  const voidMutation = useVoidTransaction()

  const filtered = transactions.filter(t =>
    t.transaction_code.toLowerCase().includes(search.toLowerCase()) ||
    t.cashier_name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleVoid() {
    if (!voidTx || !voidReason.trim()) return toast.error('Alasan void wajib diisi')
    try {
      await voidMutation.mutateAsync({ id: voidTx.id, reason: voidReason })
      toast.success('Transaksi berhasil di-void')
      setVoidTx(null); setVoidReason('')
    } catch { toast.error('Gagal void transaksi') }
  }

  function handleExport() {
    if (filtered.length === 0) return toast.error('Tidak ada data untuk diekspor')
    exportTransaksi(filtered, settings?.store_name || 'Toko')
    toast.success('File Excel berhasil didownload')
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Riwayat Transaksi"
        subtitle={`${filtered.length} transaksi`}
        action={
          <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExport}>
            Export Excel
          </Button>
        }
      />

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari kode transaksi atau nama kasir..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm
                     focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Memuat transaksi...</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<ClipboardList className="w-8 h-8" />} title="Belum ada transaksi" description="Transaksi dari kasir akan muncul di sini" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Kode', 'Waktu', 'Kasir', 'Bayar', 'Total', 'Status', ''].map((h, i) => (
                    <th key={i} className={`px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide
                      ${h === 'Total' ? 'text-right' : h === 'Status' ? 'text-center' : 'text-left'}
                      ${h === 'Waktu' ? 'hidden sm:table-cell' : ''} ${h === 'Kasir' ? 'hidden md:table-cell' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(tx => (
                  <tr key={tx.id} className={`hover:bg-gray-50 transition-colors ${tx.status === 'void' ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-700">{tx.transaction_code}</td>
                    <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{formatDate(tx.created_at)}</td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{tx.cashier_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={tx.payment_method === 'cash' ? 'blue' : 'green'}>
                        {tx.payment_method === 'cash' ? 'Tunai' : 'QRIS'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatRupiah(tx.total_amount)}</td>
                    <td className="px-4 py-3 text-center">
                      {tx.status === 'void' ? <Badge variant="red">Void</Badge> : <Badge variant="green">Selesai</Badge>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setDetailTx(tx)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary-600 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                        {tx.status === 'completed' && (
                          <button onClick={() => { setVoidTx(tx); setVoidReason('') }}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detail Modal */}
      <Modal open={!!detailTx} onClose={() => setDetailTx(null)} title={`Detail: ${detailTx?.transaction_code}`}>
        {detailTx && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-gray-500">Waktu</span><p className="font-medium">{formatDate(detailTx.created_at)}</p></div>
              <div><span className="text-gray-500">Kasir</span><p className="font-medium">{detailTx.cashier_name}</p></div>
              <div><span className="text-gray-500">Pembayaran</span><p className="font-medium capitalize">{detailTx.payment_method}</p></div>
              <div><span className="text-gray-500">Status</span>
                <p>{detailTx.status === 'void' ? <Badge variant="red">Void</Badge> : <Badge variant="green">Selesai</Badge>}</p>
              </div>
              {detailTx.void_reason && (
                <div className="col-span-2"><span className="text-gray-500">Alasan Void</span>
                  <p className="font-medium text-red-600">{detailTx.void_reason}</p></div>
              )}
            </div>
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Item</p>
              {detailItems.length === 0 ? <p className="text-sm text-gray-400">Memuat item...</p> : (
                <div className="space-y-2">
                  {detailItems.map((item: any) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">{item.product_name} <span className="text-gray-400">×{item.qty}</span></span>
                      <span className="font-medium">{formatRupiah(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-gray-100 pt-3 space-y-1 text-sm">
              {detailTx.discount > 0 && (
                <div className="flex justify-between text-red-500">
                  <span>Diskon</span><span>- {formatRupiah(detailTx.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold">
                <span>Total</span><span>{formatRupiah(detailTx.total_amount)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Dibayar</span><span>{formatRupiah(detailTx.payment_amount)}</span>
              </div>
              {detailTx.change_amount > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>Kembalian</span><span>{formatRupiah(detailTx.change_amount)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Void Modal */}
      <Modal open={!!voidTx} onClose={() => setVoidTx(null)} title="Void Transaksi">
        <div className="p-5 space-y-4">
          <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl">
            Void transaksi <strong>{voidTx?.transaction_code}</strong> senilai <strong>{formatRupiah(voidTx?.total_amount || 0)}</strong>. Tindakan ini tidak dapat dibatalkan.
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Alasan Void *</label>
            <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)}
              placeholder="Masukkan alasan void transaksi..." rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm resize-none
                         focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent" />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setVoidTx(null)}>Batal</Button>
            <Button variant="danger" className="flex-1" onClick={handleVoid} loading={voidMutation.isPending}>
              Void Transaksi
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
