import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'

import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/modules/auth/LoginPage'
import { RequireAuth } from '@/modules/auth/RequireAuth'
import { initSyncListener } from '@/modules/sync/syncEngine'

import POSPage from '@/modules/pos/PosPage'
import ProductsPage from '@/modules/products/ProductsPage'
import TransactionsPage from '@/modules/transactions/TransactionsPage'
import ReportsPage from '@/modules/reports/ReportsPage'
import SettingsPage from '@/modules/settings/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
})

export default function App() {
  useEffect(() => {
    initSyncListener()
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
            <Route index element={<Navigate to="/pos" replace />} />
            <Route path="/pos" element={<POSPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/products" element={
              <RequireAuth requiredRole="owner"><ProductsPage /></RequireAuth>
            } />
            <Route path="/reports" element={
              <RequireAuth requiredRole="owner"><ReportsPage /></RequireAuth>
            } />
            <Route path="/settings" element={
              <RequireAuth requiredRole="owner"><SettingsPage /></RequireAuth>
            } />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: '12px',
            fontSize: '14px',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
          },
        }}
      />
    </QueryClientProvider>
  )
}
