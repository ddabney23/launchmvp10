'use client'

import { useAuth } from '@/hooks/useAuth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugAdminPage() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  const dbIsAdmin = profile?.is_admin || false

  return (
    <ProtectedRoute requireAdmin>
      <div className="container mx-auto p-8 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Admin Diagnostics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>
              Signed in as <strong>{user?.email || 'N/A'}</strong>
            </p>
            <p>
              Database admin flag:{' '}
              <strong className={dbIsAdmin ? 'text-green-600' : 'text-red-600'}>
                {dbIsAdmin ? 'Enabled' : 'Disabled'}
              </strong>
            </p>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}
