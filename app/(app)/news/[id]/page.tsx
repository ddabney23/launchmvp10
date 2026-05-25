'use client'

import News from '@/views/News'
import { use } from 'react'

export default function NewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  
  return <News newsId={id} />
}

