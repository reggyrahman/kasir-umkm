import { useEffect, useRef } from 'react'
import { formatRupiah, formatDate } from '@/lib/utils'
import type { Transaction, TransactionItem } from '@/types/database'

interface NotaProps {
  transaction: Transaction
  items: TransactionItem[]
  storeName: string
  storeAddress: string
  storePhone: string
  notaFooter: string
  qrisImageUrl?: string
  onClose: () => void
}

export default function NotaPrint({
  transaction, items, storeName, storeAddress,
  storePhone, notaFooter, qrisImageUrl, onClose,
}: NotaProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const subtotalBeforeDiscount = items.reduce((s, i) => s + i.subtotal, 0)

  // Build nota HTML string untuk di-print via iframe
  function buildNotaHtml() {
    const qrisSection = transaction.payment_method === 'qris' && qrisImageUrl
      ? `<div class="divider"></div>
         <p style="text-align:center;margin:4px 0;">Scan QRIS untuk pembayaran</p>
         <div style="text-align:center;margin:8px 0;">
           <img src="${qrisImageUrl}" style="width:160px;height:160px;object-fit:contain;" />
         </div>`
      : ''

    const discountRow = transaction.discount > 0
      ? `<div class="row"><span>Subtotal</span><span>${formatRupiah(subtotalBeforeDiscount)}</span></div>
         <div class="row" style="color:#c00"><span>Diskon</span><span>- ${formatRupiah(transaction.discount)}</span></div>`
      : ''

    const changeRow = transaction.change_amount > 0
      ? `<div class="row"><span>Kembalian</span><span>${formatRupiah(transaction.change_amount)}</span></div>`
      : ''

    const itemRows = items.map(item => `
      <div style="margin-bottom:6px;">
        <div style="font-weight:600;">${item.product_name}</div>
        <div class="row muted">
          <span>${item.qty} x ${formatRupiah(item.selling_price)}</span>
          <span>${formatRupiah(item.subtotal)}</span>
        </div>
      </div>
    `).join('')

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Nota ${transaction.transaction_code}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: monospace; font-size: 12px; color: #000; background: #fff; width: 280px; padding: 8px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .divider { border-top: 1px dashed #999; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; margin: 2px 0; }
  .muted { color: #555; }
  .total { font-size: 14px; font-weight: bold; }
  @media print {
    body { width: 100%; }
    @page { margin: 4mm; size: 80mm auto; }
  }
</style>
</head>
<body>
  <div class="center bold" style="font-size:14px;margin-bottom:2px;">${storeName}</div>
  ${storeAddress ? `<div class="center muted">${storeAddress}</div>` : ''}
  ${storePhone ? `<div class="center muted">Telp: ${storePhone}</div>` : ''}

  <div class="divider"></div>

  <div class="row"><span>No.</span><span class="bold">${transaction.transaction_code}</span></div>
  <div class="row"><span>Tanggal</span><span>${formatDate(transaction.created_at)}</span></div>
  <div class="row"><span>Kasir</span><span>${transaction.cashier_name}</span></div>

  <div class="divider"></div>

  ${itemRows}

  <div class="divider"></div>

  ${discountRow}
  <div class="row total"><span>TOTAL</span><span>${formatRupiah(transaction.total_amount)}</span></div>
  <div class="row"><span>${transaction.payment_method === 'cash' ? 'Tunai' : 'QRIS'}</span><span>${formatRupiah(transaction.payment_amount)}</span></div>
  ${changeRow}

  ${qrisSection}

  <div class="divider"></div>
  <div class="center" style="margin-top:4px;">${notaFooter || 'Terima kasih!'}</div>
</body>
</html>`
  }

  function handlePrint() {
    const iframe = iframeRef.current
    if (!iframe) return
    const html = buildNotaHtml()
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
    // Tunggu gambar QRIS load kalau ada
    setTimeout(() => {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    }, qrisImageUrl ? 800 : 200)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Iframe tersembunyi untuk print */}
      <iframe ref={iframeRef} style={{ position: 'absolute', width: 0, height: 0, border: 'none', visibility: 'hidden' }} title="print-nota" />

      {/* Preview modal */}
      <div className="bg-white w-full max-w-xs rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Preview nota */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <div className="font-mono text-xs space-y-0.5 text-gray-700">
            <p className="text-center font-bold text-sm">{storeName}</p>
            {storeAddress && <p className="text-center text-gray-500">{storeAddress}</p>}
            {storePhone && <p className="text-center text-gray-500">Telp: {storePhone}</p>}

            <div className="border-t border-dashed border-gray-300 my-2" />

            <div className="flex justify-between"><span>No.</span><span className="font-bold">{transaction.transaction_code}</span></div>
            <div className="flex justify-between"><span>Tanggal</span><span>{formatDate(transaction.created_at)}</span></div>
            <div className="flex justify-between"><span>Kasir</span><span>{transaction.cashier_name}</span></div>

            <div className="border-t border-dashed border-gray-300 my-2" />

            {items.map(item => (
              <div key={item.id} className="mb-1.5">
                <div className="font-semibold">{item.product_name}</div>
                <div className="flex justify-between text-gray-500">
                  <span>{item.qty} x {formatRupiah(item.selling_price)}</span>
                  <span>{formatRupiah(item.subtotal)}</span>
                </div>
              </div>
            ))}

            <div className="border-t border-dashed border-gray-300 my-2" />

            {transaction.discount > 0 && (
              <>
                <div className="flex justify-between"><span>Subtotal</span><span>{formatRupiah(subtotalBeforeDiscount)}</span></div>
                <div className="flex justify-between text-red-500"><span>Diskon</span><span>- {formatRupiah(transaction.discount)}</span></div>
              </>
            )}
            <div className="flex justify-between font-bold text-sm"><span>TOTAL</span><span>{formatRupiah(transaction.total_amount)}</span></div>
            <div className="flex justify-between"><span>{transaction.payment_method === 'cash' ? 'Tunai' : 'QRIS'}</span><span>{formatRupiah(transaction.payment_amount)}</span></div>
            {transaction.change_amount > 0 && (
              <div className="flex justify-between font-semibold"><span>Kembalian</span><span>{formatRupiah(transaction.change_amount)}</span></div>
            )}

            {transaction.payment_method === 'qris' && qrisImageUrl && (
              <div className="flex flex-col items-center mt-3">
                <div className="border-t border-dashed border-gray-300 w-full my-2" />
                <p className="text-center text-gray-500 mb-2">Scan QRIS</p>
                <img src={qrisImageUrl} alt="QRIS" className="w-32 h-32 object-contain" />
              </div>
            )}

            <div className="border-t border-dashed border-gray-300 my-2" />
            <p className="text-center">{notaFooter || 'Terima kasih!'}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-gray-100">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Tutup
          </button>
          <button onClick={handlePrint}
            className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700">
            Print Nota
          </button>
        </div>
      </div>
    </div>
  )
}
