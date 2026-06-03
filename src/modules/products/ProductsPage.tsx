import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle, PackagePlus, History } from 'lucide-react'
import { useProducts, useDeleteProduct } from './useProducts'
import ProductFormModal from './ProductFormModal'
import RestockModal from './RestockModal'
import StockHistoryModal from './StockHistoryModal'
import { Button, Badge, Card, EmptyState, PageHeader } from '@/components/ui'
import { formatRupiah, formatNumber } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Product } from '@/types/database'

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [restockOpen, setRestockOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)

  const { data: products = [], isLoading } = useProducts(search, category)
  const deleteProduct = useDeleteProduct()

  const categories = [...new Set(products.map(p => p.category).filter(Boolean))] as string[]

  function handleEdit(p: Product) { setSelectedProduct(p); setFormOpen(true) }
  function handleRestock(p: Product) { setSelectedProduct(p); setRestockOpen(true) }
  function handleHistory(p: Product) { setSelectedProduct(p); setHistoryOpen(true) }
  function handleAdd() { setSelectedProduct(null); setFormOpen(true) }

  async function handleDelete(p: Product) {
    if (!confirm(`Hapus "${p.name}"? Barang tidak akan muncul di kasir.`)) return
    try {
      await deleteProduct.mutateAsync(p.id)
      toast.success('Barang dihapus')
    } catch { toast.error('Gagal menghapus barang') }
  }

  function stockBadge(p: Product) {
    if (p.stock_qty === 0) return <Badge variant="red">Habis</Badge>
    if (p.stock_qty <= p.min_stock) return <Badge variant="yellow">Menipis</Badge>
    return <Badge variant="green">Aman</Badge>
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Daftar Barang"
        subtitle={`${products.length} barang aktif`}
        action={
          <Button icon={<Plus className="w-4 h-4" />} onClick={handleAdd}>
            Tambah Barang
          </Button>
        }
      />

      {/* Filter */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama barang..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm
                       focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
        </div>
        {categories.length > 0 && (
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white
                       focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Semua Kategori</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {/* Alert stok menipis */}
      {products.some(p => p.stock_qty <= p.min_stock && p.stock_qty > 0) && (
        <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-800
                        text-sm px-4 py-3 rounded-xl mb-5">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Ada barang dengan stok menipis — segera lakukan restock.
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Memuat data...</div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={<Package className="w-8 h-8" />}
          title="Belum ada barang"
          description="Tambahkan barang pertama untuk mulai berjualan"
          action={<Button onClick={handleAdd} icon={<Plus className="w-4 h-4" />}>Tambah Barang</Button>}
        />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Barang</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Harga Beli</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Harga Jual</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Stok</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{p.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {p.category && <span className="mr-2">{p.category}</span>}
                        {p.sku && <span className="font-mono">{p.sku}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{formatRupiah(p.cost_price)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatRupiah(p.selling_price)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={p.stock_qty === 0 ? 'text-red-500 font-semibold' : p.stock_qty <= p.min_stock ? 'text-yellow-600 font-semibold' : 'text-gray-700'}>
                        {formatNumber(p.stock_qty)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">{stockBadge(p)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Riwayat stok */}
                        <button onClick={() => handleHistory(p)} title="Riwayat stok"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                          <History className="w-4 h-4" />
                        </button>
                        {/* Restock */}
                        <button onClick={() => handleRestock(p)} title="Restock"
                          className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors">
                          <PackagePlus className="w-4 h-4" />
                        </button>
                        {/* Edit */}
                        <button onClick={() => handleEdit(p)} title="Edit"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-primary-600 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {/* Hapus */}
                        <button onClick={() => handleDelete(p)} title="Hapus"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <ProductFormModal open={formOpen} onClose={() => setFormOpen(false)} product={selectedProduct} />
      <RestockModal open={restockOpen} onClose={() => setRestockOpen(false)} product={selectedProduct} />
      <StockHistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} product={selectedProduct} />
    </div>
  )
}
