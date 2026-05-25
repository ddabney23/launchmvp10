'use client'

import VendorDashboard from '@/views/VendorDashboard'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { use } from 'react'

export default function VendorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  
  return (
    <ProtectedRoute>
      <VendorDashboard vendorId={id} />
    </ProtectedRoute>
  )
}

