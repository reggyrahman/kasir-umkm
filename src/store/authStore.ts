import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Profile } from '@/types/database'

interface AuthState {
  profile: Profile | null
  storeId: string | null
  isAuthenticated: boolean
  _hasHydrated: boolean          // ← tambahan: track apakah persist sudah selesai hydrate
  setProfile: (profile: Profile) => void
  clearAuth: () => void
  setHasHydrated: (val: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      profile: null,
      storeId: null,
      isAuthenticated: false,
      _hasHydrated: false,

      setProfile: (profile) =>
        set({ profile, storeId: profile.store_id, isAuthenticated: true }),

      clearAuth: () =>
        set({ profile: null, storeId: null, isAuthenticated: false }),

      setHasHydrated: (val) => set({ _hasHydrated: val }),
    }),
    {
      name: 'kasir-auth',
      // Dipanggil setelah localStorage selesai dibaca
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

// Selectors
export const useIsOwner  = () => useAuthStore((s) => s.profile?.role === 'owner')
export const useStoreId  = () => useAuthStore((s) => s.storeId)
export const useProfile  = () => useAuthStore((s) => s.profile)
export const useHasHydrated = () => useAuthStore((s) => s._hasHydrated)
