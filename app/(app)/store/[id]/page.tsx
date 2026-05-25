'use client'

import VendorStoreProfile from '@/views/VendorStoreProfile'
import { use } from 'react'

export default function StorePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  
  return <VendorStoreProfile vendorId={id} />
}

