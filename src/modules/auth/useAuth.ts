import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export function useAuth() {
  const { profile, isAuthenticated, setProfile, clearAuth } = useAuthStore()

  useEffect(() => {
    // Cek session aktif saat mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        // Tidak ada session — clear auth supaya redirect ke login
        clearAuth()
      }
    })

    // Subscribe ke semua perubahan auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await loadProfile(session.user.id)
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Token berhasil di-refresh — tidak perlu reload profile
          console.log('Token refreshed silently')
        } else if (event === 'SIGNED_OUT') {
          clearAuth()
        } else if (event === 'USER_UPDATED' && session?.user) {
          await loadProfile(session.user.id)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles' as any)
      .select('*')
      .eq('id', userId)
      .single()
    if (data && !error) setProfile(data as any)
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    clearAuth()
  }

  return { profile, isAuthenticated, signIn, signOut }
}
