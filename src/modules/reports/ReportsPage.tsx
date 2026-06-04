import { useState } from 'react'
import { TrendingUp, Package, BarChart3, AlertTriangle, ArrowUpRight, ShoppingBag, Receipt, Loader2, Download } from 'lucide-react'
import { useTodaySummary, useDailyRevenue, useGrossProfitReport, useStockReport } from './useReports'
import { useSettings } from '@/modules/settings/useSettings'
import { Card, Badge, Button, PageHeader } from '@/components/ui'
import { formatRupiah, formatNumber } from '@/lib/utils'
import { exportOmzetHarian, exportLabaKotor, exportStok } from '@/lib/exportExcel'
import toast from 'react-hot-toast'

type Tab = 'overview' | 'profit' | 'stock'

function StatCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub?: string; icon: React.ReactNode; color: string
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [profitFrom, setProfitFrom] = useState(() => {
    const d = new Date(); d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [profitTo, setProfitTo] = useState(() => new Date().toISOString().slice(0, 10))

  const { data: settings } = useSettings()
  const storeName = settings?.store_name || 'Toko'

  const { data: today, isLoading: loadingToday } = useTodaySummary()
  const { data: daily = [], isLoading: loadingDaily } = useDailyRevenue(7)
  const { data: profitData = [], isLoading: loadingProfit } = useGrossProfitReport(
    profitFrom + 'T00:00:00.000+07:00', profitTo + 'T23:59:59.999+07:00'
  )
  const { data: stockData = [], isLoading: loadingStock } = useStockReport()

  const maxRevenue = Math.max(...daily.map((d: any) => d.revenue), 1)
  const stockHabis = stockData.filter((p: any) => p.stock_qty === 0).length
  const stockMenipis = stockData.filter((p: any) => p.stock_qty > 0 && p.stock_qty <= p.min_stock).length
  const totalProfit = profitData.reduce((s: number, p: any) => s + p.profit, 0)
  const totalRevenue = profitData.reduce((s: number, p: any) => s + p.revenue, 0)
  const marginPct = totalRevenue > 0 ? (totalProfit / totalRevenue * 100).toFixed(1) : '0'

  function handleExportOmzet() {
    if (daily.length === 0) return toast.error('Tidak ada data untuk diekspor')
    exportOmzetHarian(daily, storeName)
    toast.success('File Excel berhasil didownload')
  }

  function handleExportProfit() {
    if (profitData.length === 0) return toast.error('Tidak ada data untuk diekspor')
    exportLabaKotor(profitData, storeName, profitFrom, profitTo)
    toast.success('File Excel berhasil didownload')
  }

  function handleExportStok() {
    if (stockData.length === 0) return toast.error('Tidak ada data untuk diekspor')
    exportStok(stockData, storeName)
    toast.success('File Excel berhasil didownload')
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <PageHeader title="Laporan" subtitle="Ringkasan performa toko" />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit mb-6">
        {([['overview', 'Ringkasan'], ['profit', 'Laba Kotor'], ['stock', 'Stok']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {loadingToday ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Omzet Hari Ini" value={formatRupiah(today?.revenue || 0)}
                sub="transaksi selesai" icon={<TrendingUp className="w-5 h-5 text-green-600" />} color="bg-green-50" />
              <StatCard label="Laba Kotor Hari Ini" value={formatRupiah(today?.grossProfit || 0)}
                sub={today?.revenue ? `${(today.grossProfit / today.revenue * 100).toFixed(1)}% margin` : '-'}
                icon={<ArrowUpRight className="w-5 h-5 text-blue-600" />} color="bg-blue-50" />
              <StatCard label="Transaksi" value={formatNumber(today?.txCount || 0)}
                sub="hari ini" icon={<Receipt className="w-5 h-5 text-purple-600" />} color="bg-purple-50" />
              <StatCard label="Item Terjual" value={formatNumber(today?.itemCount || 0)}
                sub="hari ini" icon={<ShoppingBag className="w-5 h-5 text-orange-600" />} color="bg-orange-50" />
            </div>
          )}

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Omzet 7 Hari Terakhir</h3>
              <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExportOmzet}>
                Export Excel
              </Button>
            </div>
            {loadingDaily ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : daily.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Belum ada data transaksi</p>
            ) : (
              <div className="space-y-3">
                {daily.map((d: any) => (
                  <div key={d.date} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16 shrink-0">{d.date}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                      <div className="h-full bg-primary-500 rounded-full flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${Math.max(4, (d.revenue / maxRevenue) * 100)}%` }}>
                        {d.revenue / maxRevenue > 0.3 && (
                          <span className="text-xs text-white font-medium">{formatRupiah(d.revenue)}</span>
                        )}
                      </div>
                    </div>
                    {d.revenue / maxRevenue <= 0.3 && (
                      <span className="text-xs text-gray-600 w-28 text-right shrink-0">{formatRupiah(d.revenue)}</span>
                    )}
                    <span className="text-xs text-gray-400 shrink-0">{d.count}x</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Laba Kotor ── */}
      {tab === 'profit' && (
        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-gray-700">Periode:</span>
              <input type="date" value={profitFrom} onChange={e => setProfitFrom(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <span className="text-sm text-gray-400">s/d</span>
              <input type="date" value={profitTo} onChange={e => setProfitTo(e.target.value)}
                className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExportProfit}>
                Export Excel
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total Omzet" value={formatRupiah(totalRevenue)}
              icon={<TrendingUp className="w-5 h-5 text-green-600" />} color="bg-green-50" />
            <StatCard label="Laba Kotor" value={formatRupiah(totalProfit)}
              icon={<ArrowUpRight className="w-5 h-5 text-blue-600" />} color="bg-blue-50" />
            <StatCard label="Margin" value={`${marginPct}%`}
              sub="laba / omzet" icon={<BarChart3 className="w-5 h-5 text-purple-600" />} color="bg-purple-50" />
          </div>

          <Card>
            {loadingProfit ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : profitData.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Tidak ada data pada periode ini</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Barang', 'Terjual', 'Omzet', 'HPP', 'Laba', 'Margin'].map(h => (
                        <th key={h} className={`px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide ${h === 'Barang' ? 'text-left' : 'text-right'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {profitData.map((p: any) => (
                      <tr key={p.name} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatNumber(p.qty)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatRupiah(p.revenue)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{formatRupiah(p.cogs)}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${p.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{formatRupiah(p.profit)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{p.revenue > 0 ? (p.profit / p.revenue * 100).toFixed(1) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                      <td className="px-4 py-3 text-gray-800">Total</td>
                      <td className="px-4 py-3 text-right">{formatNumber(profitData.reduce((s: number, p: any) => s + p.qty, 0))}</td>
                      <td className="px-4 py-3 text-right">{formatRupiah(totalRevenue)}</td>
                      <td className="px-4 py-3 text-right">{formatRupiah(profitData.reduce((s: number, p: any) => s + p.cogs, 0))}</td>
                      <td className="px-4 py-3 text-right text-green-600">{formatRupiah(totalProfit)}</td>
                      <td className="px-4 py-3 text-right">{marginPct}%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Stok ── */}
      {tab === 'stock' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-3 flex-wrap">
              {stockHabis > 0 && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-xl">
                  <AlertTriangle className="w-4 h-4" />
                  <span><strong>{stockHabis}</strong> barang stok habis</span>
                </div>
              )}
              {stockMenipis > 0 && (
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm px-4 py-2.5 rounded-xl">
                  <AlertTriangle className="w-4 h-4" />
                  <span><strong>{stockMenipis}</strong> barang stok menipis</span>
                </div>
              )}
            </div>
            <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={handleExportStok}>
              Export Excel
            </Button>
          </div>

          <Card>
            {loadingStock ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : stockData.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Belum ada barang</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Barang', 'Stok', 'Min. Stok', 'Nilai Stok', 'Status'].map(h => (
                        <th key={h} className={`px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide ${h === 'Barang' ? 'text-left' : 'text-right'} ${h === 'Status' ? '!text-center' : ''}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {stockData.map((p: any) => {
                      const status = p.stock_qty === 0 ? 'habis' : p.stock_qty <= p.min_stock ? 'menipis' : 'aman'
                      return (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{p.name}</div>
                            {p.category && <div className="text-xs text-gray-400">{p.category}</div>}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${p.stock_qty === 0 ? 'text-red-500' : p.stock_qty <= p.min_stock ? 'text-yellow-600' : 'text-gray-800'}`}>
                            {formatNumber(p.stock_qty)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">{formatNumber(p.min_stock)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{formatRupiah(p.stock_qty * p.cost_price)}</td>
                          <td className="px-4 py-3 text-center">
                            {status === 'habis' && <Badge variant="red">Habis</Badge>}
                            {status === 'menipis' && <Badge variant="yellow">Menipis</Badge>}
                            {status === 'aman' && <Badge variant="green">Aman</Badge>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                      <td className="px-4 py-3 text-gray-800">Total Nilai Stok</td>
                      <td colSpan={2} />
                      <td className="px-4 py-3 text-right text-gray-900">{formatRupiah(stockData.reduce((s: number, p: any) => s + p.stock_qty * p.cost_price, 0))}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}
