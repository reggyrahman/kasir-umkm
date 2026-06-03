import { useState, useEffect } from 'react'
import { Modal, Button, Input } from '@/components/ui'
import { useCreateProduct, useUpdateProduct, type ProductInput } from './useProducts'
import { parseRupiahInput, formatNumber } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Product } from '@/types/database'

interface Props {
  open: boolean
  onClose: () => void
  product?: Product | null
}

const EMPTY: ProductInput = {
  name: '', sku: null, category: null,
  selling_price: 0, cost_price: 0,
  stock_qty: 0, min_stock: 5, is_active: true,
}

export default function ProductFormModal({ open, onClose, product }: Props) {
  const [form, setForm] = useState<ProductInput>(EMPTY)
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const isEdit = !!product

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name, sku: product.sku, category: product.category,
        selling_price: product.selling_price, cost_price: product.cost_price,
        stock_qty: product.stock_qty, min_stock: product.min_stock, is_active: product.is_active,
      })
    } else {
      setForm(EMPTY)
    }
  }, [product, open])

  function set(key: keyof ProductInput, value: any) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit() {
    if (!form.name.trim()) return toast.error('Nama barang wajib diisi')
    if (form.selling_price <= 0) return toast.error('Harga jual harus lebih dari 0')
    if (form.cost_price > form.selling_price) {
      if (!confirm('Harga beli lebih tinggi dari harga jual. Lanjutkan?')) return
    }

    try {
      if (isEdit && product) {
        await update.mutateAsync({ id: product.id, ...form })
        toast.success('Barang berhasil diperbarui')
      } else {
        await create.mutateAsync(form)
        toast.success('Barang berhasil ditambahkan')
      }
      onClose()
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan barang')
    }
  }

  const loading = create.isPending || update.isPending

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Edit Barang' : 'Tambah Barang'}>
      <div className="p-5 space-y-4">
        {/* Nama */}
        <Input
          label="Nama Barang *"
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Contoh: Aqua 600ml"
        />

        <div className="grid grid-cols-2 gap-3">
          {/* SKU */}
          <Input
            label="SKU / Kode"
            value={form.sku || ''}
            onChange={e => set('sku', e.target.value || null)}
            placeholder="Opsional"
          />
          {/* Kategori */}
          <Input
            label="Kategori"
            value={form.category || ''}
            onChange={e => set('category', e.target.value || null)}
            placeholder="Minuman, Makanan..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Harga Beli */}
          <Input
            label="Harga Beli (HPP)"
            value={form.cost_price > 0 ? formatNumber(form.cost_price) : ''}
            onChange={e => set('cost_price', parseRupiahInput(e.target.value))}
            placeholder="0"
            prefix="Rp"
          />
          {/* Harga Jual */}
          <Input
            label="Harga Jual *"
            value={form.selling_price > 0 ? formatNumber(form.selling_price) : ''}
            onChange={e => set('selling_price', parseRupiahInput(e.target.value))}
            placeholder="0"
            prefix="Rp"
          />
        </div>

        {/* Laba preview */}
        {form.selling_price > 0 && form.cost_price > 0 && (
          <div className={`text-xs px-3 py-2 rounded-lg ${
            form.selling_price >= form.cost_price
              ? 'bg-green-50 text-green-700'
              : 'bg-red-50 text-red-600'
          }`}>
            Laba per unit: Rp {formatNumber(form.selling_price - form.cost_price)}
            {' '}({((form.selling_price - form.cost_price) / form.selling_price * 100).toFixed(1)}%)
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {/* Stok */}
          <Input
            label={isEdit ? 'Stok Saat Ini' : 'Stok Awal'}
            type="number" min="0"
            value={form.stock_qty}
            onChange={e => set('stock_qty', parseInt(e.target.value) || 0)}
          />
          {/* Min Stok */}
          <Input
            label="Stok Minimum"
            type="number" min="0"
            value={form.min_stock}
            onChange={e => set('min_stock', parseInt(e.target.value) || 0)}
          />
        </div>

        <p className="text-xs text-gray-400">
          * Stok minimum digunakan untuk peringatan stok menipis
        </p>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button className="flex-1" onClick={handleSubmit} loading={loading}>
            {isEdit ? 'Simpan Perubahan' : 'Tambah Barang'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
