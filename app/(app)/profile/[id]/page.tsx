'use client'

import Profile from '@/views/Profile'
import { use } from 'react'

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  
  return <Profile userId={id} />
}

