import { useState } from 'react'
import { Modal, Button } from '@/components/ui'
import { formatRupiah, parseRupiahInput, formatNumber } from '@/lib/utils'
import { Banknote, QrCode } from 'lucide-react'
import type { PaymentMethod } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  total: number
  qrisImageUrl?: string
  onConfirm: (method: PaymentMethod, paymentAmount: number) => void
  loading?: boolean
}

const QUICK_AMOUNTS = [10000, 20000, 50000, 100000]

export default function CheckoutModal({ open, onClose, total, qrisImageUrl, onConfirm, loading }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [paymentInput, setPaymentInput] = useState('')

  const paymentAmount = method === 'cash' ? parseRupiahInput(paymentInput) : total
  const change = paymentAmount - total
  const isValid = method === 'qris' || paymentAmount >= total

  function handleConfirm() {
    if (!isValid) return
    onConfirm(method, paymentAmount)
  }

  function setQuick(amount: number) {
    setPaymentInput(formatNumber(amount))
  }

  // Quick amounts yang >= total
  const smartAmounts = [
    ...QUICK_AMOUNTS.filter(a => a >= total),
    Math.ceil(total / 1000) * 1000, // dibulatkan ke atas ribuan
  ].filter((v, i, arr) => arr.indexOf(v) === i).sort((a, b) => a - b).slice(0, 4)

  return (
    <Modal open={open} onClose={onClose} title="Pembayaran">
      <div className="p-5 space-y-4">
        {/* Total */}
        <div className="bg-primary-50 rounded-xl p-4 text-center">
          <p className="text-sm text-primary-600 font-medium mb-1">Total Pembayaran</p>
          <p className="text-3xl font-bold text-primary-700">{formatRupiah(total)}</p>
        </div>

        {/* Metode */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMethod('cash')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all
              ${method === 'cash'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
          >
            <Banknote className="w-4 h-4" />
            Tunai
          </button>
          <button
            onClick={() => setMethod('qris')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl border-2 text-sm font-semibold transition-all
              ${method === 'qris'
                ? 'border-primary-500 bg-primary-50 text-primary-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
          >
            <QrCode className="w-4 h-4" />
            QRIS
          </button>
        </div>

        {/* Tunai: input nominal */}
        {method === 'cash' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Uang Diterima</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-gray-500">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={paymentInput}
                  onChange={e => setPaymentInput(formatNumber(parseRupiahInput(e.target.value)))}
                  placeholder="0"
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-right font-semibold"
                />
              </div>
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2">
              {smartAmounts.map(a => (
                <button key={a} onClick={() => setQuick(a)}
                  className="py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition-colors">
                  {formatNumber(a)}
                </button>
              ))}
            </div>

            {/* Kembalian */}
            {paymentAmount > 0 && (
              <div className={`flex justify-between items-center px-4 py-3 rounded-xl text-sm font-semibold
                ${change >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                <span>{change >= 0 ? 'Kembalian' : 'Kurang'}</span>
                <span>{formatRupiah(Math.abs(change))}</span>
              </div>
            )}
          </div>
        )}

        {/* QRIS: tampilkan gambar QR */}
        {method === 'qris' && (
          <div className="flex flex-col items-center py-4 space-y-3">
            {qrisImageUrl ? (
              <>
                <img src={qrisImageUrl} alt="QRIS" className="w-48 h-48 object-contain rounded-xl border border-gray-200" />
                <p className="text-sm text-gray-500">Minta customer scan QR di atas</p>
                <p className="text-xs text-gray-400">Setelah pembayaran masuk, tekan Konfirmasi</p>
              </>
            ) : (
              <div className="w-48 h-48 bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-2">
                <QrCode className="w-12 h-12 text-gray-400" />
                <p className="text-xs text-gray-500 text-center px-4">QRIS belum diatur.<br/>Atur di menu Pengaturan.</p>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={!isValid}
            loading={loading}
          >
            {method === 'qris' ? 'Konfirmasi Diterima' : 'Proses Pembayaran'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
