import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import {
  ShoppingBag, LayoutDashboard, Package,
  ClipboardList, BarChart3, Settings, LogOut,
  Wifi, WifiOff, RefreshCw
} from 'lucide-react'
import { useAuthStore, useIsOwner, useProfile } from '@/store/authStore'
import { useSyncStore } from '@/store/syncStore'
import { useAuth } from '@/modules/auth/useAuth'
import { flushSyncQueue } from '@/modules/sync/syncEngine'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/pos',          icon: ShoppingBag,    label: 'Kasir',       ownerOnly: false },
  { to: '/transactions', icon: ClipboardList,  label: 'Transaksi',   ownerOnly: false },
  { to: '/products',     icon: Package,        label: 'Barang',      ownerOnly: true  },
  { to: '/reports',      icon: BarChart3,      label: 'Laporan',     ownerOnly: true  },
  { to: '/settings',     icon: Settings,       label: 'Pengaturan',  ownerOnly: true  },
]

export default function AppLayout() {
  const isOwner = useIsOwner()
  const { profile, clearAuth } = useAuthStore()
  const { isOnline, isSyncing, pendingCount } = useSyncStore()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  // Auto-logout kalau session expired
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        clearAuth()
        navigate('/login')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await signOut()
    navigate('/login')
    toast.success('Berhasil keluar')
  }

  async function handleManualSync() {
    if (!isOnline) return toast.error('Tidak ada koneksi internet')
    await flushSyncQueue()
    toast.success('Sync selesai')
  }

  const visibleNav = navItems.filter(item => !item.ownerOnly || isOwner)

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Sidebar */}
      <aside className="w-16 lg:w-56 flex flex-col bg-white border-r border-border shrink-0">
        {/* Brand */}
        <div className="h-14 flex items-center px-3 lg:px-4 border-b border-border gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center shrink-0">
            <ShoppingBag className="w-4 h-4 text-white" />
          </div>
          <span className="hidden lg:block font-bold text-sm text-text">Kasir UMKM</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {visibleNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-2 lg:px-3 py-2.5 rounded-xl transition-all text-sm font-medium
                 ${isActive
                   ? 'bg-primary-50 text-primary-700'
                   : 'text-text-secondary hover:bg-surface hover:text-text'
                 }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span className="hidden lg:block">{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sync status + user */}
        <div className="border-t border-border p-2 space-y-1">
          {/* Sync indicator */}
          <button
            onClick={handleManualSync}
            className="w-full flex items-center gap-3 px-2 lg:px-3 py-2 rounded-xl
                       text-sm text-text-secondary hover:bg-surface transition-all"
            title={isOnline ? 'Online' : 'Offline'}
          >
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-primary-500" />
            ) : isOnline ? (
              <Wifi className="w-4 h-4 shrink-0 text-green-500" />
            ) : (
              <WifiOff className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span className="hidden lg:block text-xs">
              {isSyncing ? 'Menyinkron...' : isOnline ? 'Online' : `Offline${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
            </span>
          </button>

          {/* User */}
          <div className="flex items-center gap-3 px-2 lg:px-3 py-2">
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-primary-700">
                {profile?.full_name?.charAt(0).toUpperCase() || '?'}
              </span>
            </div>
            <div className="hidden lg:flex flex-1 min-w-0 flex-col">
              <p className="text-xs font-semibold text-text truncate">{profile?.full_name}</p>
              <p className="text-xs text-muted capitalize">{profile?.role === 'owner' ? 'Pemilik' : 'Kasir'}</p>
            </div>
            <button onClick={handleLogout} 
              title="Keluar"
              className="text-muted hover:text-red-500 transition-colors p-1 rounded-lg hover:bg-red-50">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
