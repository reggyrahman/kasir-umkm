import * as XLSX from 'xlsx'
import { formatRupiah } from './utils'

// ─── Export Laporan Omzet Harian ─────────────────────────────────
export function exportOmzetHarian(data: any[], storeName: string) {
  const rows = [
    [`LAPORAN OMZET HARIAN - ${storeName}`],
    [`Diekspor: ${new Date().toLocaleString('id-ID')}`],
    [],
    ['Tanggal', 'Jumlah Transaksi', 'Omzet'],
    ...data.map(d => [d.date, d.count, d.revenue]),
    [],
    ['TOTAL', data.reduce((s: number, d: any) => s + d.count, 0), data.reduce((s: number, d: any) => s + d.revenue, 0)],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 20 }, { wch: 20 }, { wch: 20 }]

  // Style header
  styleHeader(ws, 'A1')

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Omzet Harian')
  XLSX.writeFile(wb, `omzet-harian-${dateStr()}.xlsx`)
}

// ─── Export Laba Kotor ────────────────────────────────────────────
export function exportLabaKotor(data: any[], storeName: string, dateFrom: string, dateTo: string) {
  const totalRevenue = data.reduce((s: number, p: any) => s + p.revenue, 0)
  const totalCogs = data.reduce((s: number, p: any) => s + p.cogs, 0)
  const totalProfit = data.reduce((s: number, p: any) => s + p.profit, 0)
  const totalQty = data.reduce((s: number, p: any) => s + p.qty, 0)

  const rows = [
    [`LAPORAN LABA KOTOR - ${storeName}`],
    [`Periode: ${dateFrom} s/d ${dateTo}`],
    [`Diekspor: ${new Date().toLocaleString('id-ID')}`],
    [],
    ['Nama Barang', 'Qty Terjual', 'Omzet (Rp)', 'HPP (Rp)', 'Laba Kotor (Rp)', 'Margin (%)'],
    ...data.map((p: any) => [
      p.name,
      p.qty,
      p.revenue,
      p.cogs,
      p.profit,
      p.revenue > 0 ? +((p.profit / p.revenue) * 100).toFixed(1) : 0,
    ]),
    [],
    ['TOTAL', totalQty, totalRevenue, totalCogs, totalProfit,
      totalRevenue > 0 ? +((totalProfit / totalRevenue) * 100).toFixed(1) : 0],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }]
  styleHeader(ws, 'A1')

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Laba Kotor')
  XLSX.writeFile(wb, `laba-kotor-${dateStr()}.xlsx`)
}

// ─── Export Stok ──────────────────────────────────────────────────
export function exportStok(data: any[], storeName: string) {
  const rows = [
    [`LAPORAN STOK BARANG - ${storeName}`],
    [`Diekspor: ${new Date().toLocaleString('id-ID')}`],
    [],
    ['Nama Barang', 'Kategori', 'Stok', 'Min. Stok', 'Harga Beli (Rp)', 'Harga Jual (Rp)', 'Nilai Stok (Rp)', 'Status'],
    ...data.map((p: any) => {
      const status = p.stock_qty === 0 ? 'Habis' : p.stock_qty <= p.min_stock ? 'Menipis' : 'Aman'
      return [p.name, p.category || '-', p.stock_qty, p.min_stock, p.cost_price, p.selling_price, p.stock_qty * p.cost_price, status]
    }),
    [],
    ['TOTAL NILAI STOK', '', '', '', '', '', data.reduce((s: number, p: any) => s + p.stock_qty * p.cost_price, 0), ''],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 8 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 10 }]
  styleHeader(ws, 'A1')

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Stok Barang')
  XLSX.writeFile(wb, `stok-barang-${dateStr()}.xlsx`)
}

// ─── Export Riwayat Transaksi ─────────────────────────────────────
export function exportTransaksi(transactions: any[], storeName: string) {
  const rows = [
    [`RIWAYAT TRANSAKSI - ${storeName}`],
    [`Diekspor: ${new Date().toLocaleString('id-ID')}`],
    [],
    ['Kode', 'Tanggal', 'Kasir', 'Metode Bayar', 'Diskon (Rp)', 'Total (Rp)', 'Dibayar (Rp)', 'Kembalian (Rp)', 'Status'],
    ...transactions.map(tx => [
      tx.transaction_code,
      new Date(tx.created_at).toLocaleString('id-ID'),
      tx.cashier_name,
      tx.payment_method === 'cash' ? 'Tunai' : 'QRIS',
      tx.discount,
      tx.total_amount,
      tx.payment_amount,
      tx.change_amount,
      tx.status === 'completed' ? 'Selesai' : 'Void',
    ]),
    [],
    ['', '', '', '', '',
      transactions.filter(t => t.status === 'completed').reduce((s, t) => s + t.total_amount, 0),
      '', '', ''],
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }]
  styleHeader(ws, 'A1')

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Transaksi')
  XLSX.writeFile(wb, `transaksi-${dateStr()}.xlsx`)
}

// ─── Helpers ──────────────────────────────────────────────────────
function dateStr() {
  return new Date().toISOString().slice(0, 10)
}

function styleHeader(ws: XLSX.WorkSheet, cell: string) {
  if (!ws[cell]) return
  ws[cell].s = { font: { bold: true, sz: 13 } }
}
