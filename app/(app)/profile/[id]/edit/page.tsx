'use client'

import ProfileEdit from '@/views/ProfileEdit'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { use } from 'react'

export default function ProfileEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  
  return (
    <ProtectedRoute>
      <ProfileEdit userId={id} />
    </ProtectedRoute>
  )
}

