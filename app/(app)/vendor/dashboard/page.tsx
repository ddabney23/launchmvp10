'use client'

import VendorDashboard from '@/views/VendorDashboard'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function VendorDashboardPage() {
  return (
    <ProtectedRoute>
      <VendorDashboard />
    </ProtectedRoute>
  )
}

