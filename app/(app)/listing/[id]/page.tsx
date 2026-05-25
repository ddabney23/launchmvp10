'use client'

import ListingDetail from '@/views/ListingDetail'
import { use } from 'react'

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  
  return <ListingDetail listingId={id} />
}

