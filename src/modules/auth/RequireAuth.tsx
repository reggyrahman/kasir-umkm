import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { UserRole } from '@/types/database'

interface Props {
  children: React.ReactNode
  requiredRole?: UserRole
}

export function RequireAuth({ children, requiredRole }: Props) {
  const { isAuthenticated, profile } = useAuthStore()

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (requiredRole && profile?.role !== requiredRole) {
    return <Navigate to="/pos" replace />
  }

  return <>{children}</>
}
