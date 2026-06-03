import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/database'

interface Props {
  children: React.ReactNode
  requiredRole?: UserRole
}

export function RequireAuth({ children, requiredRole }: Props) {
  const { isAuthenticated, profile } = useAuthStore()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(() => {
      setChecking(false)
    })
  }, [])

  if (checking) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #1d9e75', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to="/pos" replace />
  }
  return <>{children}</>
}
