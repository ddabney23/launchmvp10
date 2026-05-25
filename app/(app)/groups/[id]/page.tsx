'use client'

import Groups from '@/views/Groups'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { use } from 'react'

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  
  return (
    <ProtectedRoute>
      <Groups groupId={id} />
    </ProtectedRoute>
  )
}

