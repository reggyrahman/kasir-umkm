import { useState, useEffect, useRef } from 'react'
import { Store, QrCode, FileText, Upload, Check, Loader2 } from 'lucide-react'
import { useSettings, useUpdateSettings } from './useSettings'
import { Button, Card, PageHeader } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useStoreId } from '@/store/authStore'
import toast from 'react-hot-toast'

const sb = supabase as any

export default function SettingsPage() {
  const storeId = useStoreId()
  const { data: settings, isLoading } = useSettings()
  const updateSettings = useUpdateSettings()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    store_name: '', store_address: '', store_phone: '',
    nota_header: '', nota_footer: '', qris_image_url: '',
  })
  const [uploadingQris, setUploadingQris] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) {
      setForm({
        store_name:     settings.store_name     || '',
        store_address:  settings.store_address  || '',
        store_phone:    settings.store_phone    || '',
        nota_header:    settings.nota_header    || '',
        nota_footer:    settings.nota_footer    || 'Terima kasih sudah berbelanja!',
        qris_image_url: settings.qris_image_url || '',
      })
    }
  }, [settings])

  function set(key: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    try {
      await updateSettings.mutateAsync(form)
      setSaved(true)
      toast.success('Pengaturan berhasil disimpan')
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast.error('Gagal menyimpan pengaturan')
    }
  }

  async function handleQrisUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return toast.error('File harus berupa gambar')
    if (file.size > 2 * 1024 * 1024) return toast.error('Ukuran gambar maksimal 2MB')

    setUploadingQris(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `qris/${storeId}/qris.${ext}`
      const { error: uploadError } = await sb.storage
        .from('store-assets').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError

      const { data } = sb.storage.from('store-assets').getPublicUrl(path)
      const url = data.publicUrl + '?t=' + Date.now()
      setForm(f => ({ ...f, qris_image_url: url }))
      toast.success('Gambar QRIS berhasil diupload')
    } catch (e: any) {
      // Fallback: simpan sebagai base64 jika storage belum dikonfigurasi
      const reader = new FileReader()
      reader.onload = (ev) => {
        const base64 = ev.target?.result as string
        setForm(f => ({ ...f, qris_image_url: base64 }))
        toast.success('Gambar QRIS siap (base64)')
      }
      reader.readAsDataURL(file)
    } finally {
      setUploadingQris(false)
    }
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <PageHeader
        title="Pengaturan"
        subtitle="Konfigurasi toko dan tampilan nota"
        action={
          <Button onClick={handleSave} loading={updateSettings.isPending}
            icon={saved ? <Check className="w-4 h-4" /> : undefined}>
            {saved ? 'Tersimpan!' : 'Simpan'}
          </Button>
        }
      />

      <div className="space-y-5">
        {/* Info Toko */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Store className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-gray-800">Informasi Toko</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Toko</label>
              <input value={form.store_name} onChange={e => set('store_name', e.target.value)}
                placeholder="Nama toko Anda"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat</label>
              <input value={form.store_address} onChange={e => set('store_address', e.target.value)}
                placeholder="Alamat lengkap toko"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">No. Telepon</label>
              <input value={form.store_phone} onChange={e => set('store_phone', e.target.value)}
                placeholder="08xxxxxxxxxx"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
          </div>
        </Card>

        {/* QRIS */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <QrCode className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-gray-800">QRIS Statis</h2>
          </div>
          <div className="flex gap-4 items-start">
            {/* Preview */}
            <div className="w-32 h-32 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center shrink-0 overflow-hidden bg-gray-50">
              {form.qris_image_url ? (
                <img src={form.qris_image_url} alt="QRIS" className="w-full h-full object-contain" />
              ) : (
                <QrCode className="w-10 h-10 text-gray-300" />
              )}
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-sm text-gray-500">
                Upload gambar QRIS statis dari bank/dompet digital. Gambar akan ditampilkan saat customer memilih pembayaran QRIS.
              </p>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleQrisUpload} className="hidden" />
              <Button
                variant="secondary"
                size="sm"
                icon={uploadingQris ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingQris}
              >
                {uploadingQris ? 'Mengupload...' : form.qris_image_url ? 'Ganti Gambar QRIS' : 'Upload Gambar QRIS'}
              </Button>
              {form.qris_image_url && (
                <button onClick={() => set('qris_image_url', '')}
                  className="block text-xs text-red-400 hover:text-red-600 transition-colors">
                  Hapus QRIS
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Nota */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-4 h-4 text-primary-600" />
            <h2 className="font-semibold text-gray-800">Pengaturan Nota</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Header Nota</label>
              <input value={form.nota_header} onChange={e => set('nota_header', e.target.value)}
                placeholder="Teks di atas nota (kosongkan untuk nama toko)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Footer Nota</label>
              <input value={form.nota_footer} onChange={e => set('nota_footer', e.target.value)}
                placeholder="Terima kasih sudah berbelanja!"
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
            </div>
          </div>

          {/* Preview nota mini */}
          <div className="mt-4 border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Preview Nota</p>
            <div className="font-mono text-xs space-y-0.5 text-gray-700">
              <p className="text-center font-bold">{form.store_name || 'Nama Toko'}</p>
              {form.store_address && <p className="text-center text-gray-500">{form.store_address}</p>}
              <p className="text-center">--------------------------------</p>
              <p>Nama Barang       x1   Rp 10.000</p>
              <p>Nama Barang 2     x2   Rp 20.000</p>
              <p>--------------------------------</p>
              <p className="font-bold">TOTAL              Rp 30.000</p>
              <p>Tunai              Rp 50.000</p>
              <p>Kembalian          Rp 20.000</p>
              <p className="text-center">--------------------------------</p>
              <p className="text-center">{form.nota_footer || 'Terima kasih!'}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
