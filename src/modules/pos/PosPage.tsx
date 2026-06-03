import { useState, useCallback } from 'react'
import { ShoppingCart, Search, Plus, Minus, Trash2, Tag, X } from 'lucide-react'
import { useProducts } from '@/modules/products/useProducts'
import { useCartStore, useCartTotal, useCartItemCount } from '@/store/cartStore'
import { useCheckout } from '@/modules/transactions/useTransactions'
import { useTransactionItems } from '@/modules/transactions/useTransactions'
import CheckoutModal from './CheckoutModal'
import NotaPrint from './NotaPrint'
import { formatRupiah, parseRupiahInput, formatNumber } from '@/lib/utils'
import { useStoreId } from '@/store/authStore'
import { useSettings } from '@/modules/settings/useSettings'
import toast from 'react-hot-toast'
import type { Transaction } from '@/types/database'
import type { PaymentMethod } from '@/types/database'

export default function POSPage() {
  const [search, setSearch] = useState('')
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null)
  const [discountInput, setDiscountInput] = useState('')

  const storeId = useStoreId()
  const { data: products = [], isLoading } = useProducts(search)
  const { items, discount, addItem, removeItem, updateQty, setDiscount, clearCart } = useCartStore()
  const total = useCartTotal()
  const itemCount = useCartItemCount()
  const checkout = useCheckout()

  const { data: settings } = useSettings()

  // Items dari transaksi yang baru selesai (untuk nota)
  const { data: completedItems = [] } = useTransactionItems(completedTx?.id ?? null)

  const handleSearch = useCallback((val: string) => setSearch(val), [])

  function handleDiscountChange(val: string) {
    setDiscountInput(val)
    setDiscount(parseRupiahInput(val))
  }

  async function handleCheckout(method: PaymentMethod, paymentAmount: number) {
    if (items.length === 0) return
    try {
      const result = await checkout.mutateAsync({ items, discount, paymentMethod: method, paymentAmount })
      setCompletedTx(result.transaction)
      setCheckoutOpen(false)
      clearCart()
      setDiscountInput('')
      toast.success('Transaksi berhasil!')
    } catch (e: any) {
      toast.error(e.message || 'Transaksi gagal')
    }
  }

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0)

  return (
    <div className="flex h-full">
      {/* ── Kiri: Daftar Produk ── */}
      <div className="flex-1 flex flex-col overflow-hidden border-r border-gray-100">
        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Cari nama barang..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm
                         focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Product grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-16 text-gray-400 text-sm">Memuat barang...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">
              {search ? 'Barang tidak ditemukan' : 'Belum ada barang. Tambahkan di menu Barang.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {products.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    if (p.stock_qty === 0) { toast.error('Stok habis'); return }
                    addItem(p)
                  }}
                  className={`bg-white border rounded-xl p-3 text-left transition-all hover:shadow-md active:scale-95
                    ${p.stock_qty === 0 ? 'opacity-50 cursor-not-allowed border-gray-100' : 'border-gray-200 hover:border-primary-300'}`}
                >
                  <div className="font-semibold text-sm text-gray-800 leading-tight mb-1 line-clamp-2">{p.name}</div>
                  {p.category && <div className="text-xs text-gray-400 mb-2">{p.category}</div>}
                  <div className="font-bold text-primary-600 text-sm">{formatRupiah(p.selling_price)}</div>
                  <div className={`text-xs mt-1 ${p.stock_qty === 0 ? 'text-red-500' : p.stock_qty <= p.min_stock ? 'text-yellow-600' : 'text-gray-400'}`}>
                    Stok: {formatNumber(p.stock_qty)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Kanan: Keranjang ── */}
      <div className="w-80 flex flex-col bg-white">
        {/* Header keranjang */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-gray-600" />
            <span className="font-semibold text-gray-800">Keranjang</span>
            {itemCount > 0 && (
              <span className="bg-primary-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </div>
          {items.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-400 hover:text-red-600 transition-colors">
              Kosongkan
            </button>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
              <ShoppingCart className="w-12 h-12 mb-3 opacity-30" />
              <p>Keranjang kosong</p>
              <p className="text-xs mt-1">Tap barang untuk menambahkan</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {items.map(item => (
                <div key={item.product.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-800 leading-tight flex-1">{item.product.name}</span>
                    <button onClick={() => removeItem(item.product.id)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.product.id, item.qty - 1)}
                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-semibold w-6 text-center">{item.qty}</span>
                      <button
                        onClick={() => {
                          if (item.qty >= item.product.stock_qty) { toast.error('Stok tidak cukup'); return }
                          updateQty(item.product.id, item.qty + 1)
                        }}
                        className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-gray-800">{formatRupiah(item.subtotal)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary & checkout */}
        {items.length > 0 && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            {/* Diskon */}
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-gray-400 shrink-0" />
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={discountInput}
                  onChange={e => handleDiscountChange(formatNumber(parseRupiahInput(e.target.value)))}
                  placeholder="Diskon"
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Subtotal & diskon */}
            {discount > 0 && (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span>{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Diskon</span>
                  <span>- {formatRupiah(discount)}</span>
                </div>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-between items-center py-2 border-t border-gray-100">
              <span className="font-semibold text-gray-700">Total</span>
              <span className="text-xl font-bold text-primary-600">{formatRupiah(total)}</span>
            </div>

            {/* Bayar button */}
            <button
              onClick={() => setCheckoutOpen(true)}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl
                         transition-colors text-sm shadow-sm active:scale-95"
            >
              Bayar Sekarang
            </button>
          </div>
        )}
      </div>

      {/* Checkout modal */}
      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        total={total}
        qrisImageUrl={settings?.['qris_image_url']}
        onConfirm={handleCheckout}
        loading={checkout.isPending}
      />

      {/* Nota print */}
      {completedTx && (
        <NotaPrint
          transaction={completedTx}
          items={completedItems}
          storeName={settings?.['store_name'] || 'Toko'}
          storeAddress={settings?.['store_address'] || ''}
          storePhone={settings?.['store_phone'] || ''}
          notaFooter={settings?.['nota_footer'] || 'Terima kasih!'}
          qrisImageUrl={settings?.['qris_image_url']}
          onClose={() => setCompletedTx(null)}
        />
      )}
    </div>
  )
}
