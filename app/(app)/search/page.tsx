import { Suspense } from 'react'
import Search from '@/views/Search'
import { Loader2 } from 'lucide-react'

function SearchFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchFallback />}>
      <Search />
    </Suspense>
  )
}

