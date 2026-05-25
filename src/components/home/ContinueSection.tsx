'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Store, ArrowRight } from 'lucide-react'

const STORAGE_KEY = 'optimix_last_store_path'

export function setLastStorePath(path: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, path)
  }
}

export function ContinueSection() {
  const [lastPath, setLastPath] = useState<string | null>(null)

  useEffect(() => {
    setLastPath(localStorage.getItem(STORAGE_KEY))
  }, [])

  if (!lastPath) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Store className="h-4 w-4" />
          Continue where you left off
        </CardTitle>
        <CardDescription>Return to the last store you visited</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={lastPath}>
          <Button variant="outline" className="w-full">
            Continue shopping
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
