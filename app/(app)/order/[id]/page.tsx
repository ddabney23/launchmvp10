'use client'

import OrderDetail from '@/views/OrderDetail'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { use } from 'react'

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  
  return (
    <ProtectedRoute>
      <OrderDetail orderId={id} />
    </ProtectedRoute>
  )
}

