'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Newspaper, ArrowRight } from 'lucide-react'

export function NewsTeaser() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Newspaper className="h-4 w-4" />
          Community news
        </CardTitle>
        <CardDescription>Updates and announcements from Optimix</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href="/news">
          <Button variant="outline" size="sm" className="w-full">
            Read latest news
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
