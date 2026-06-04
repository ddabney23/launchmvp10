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
            <CardTitle>Admin Debug Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold">User Object:</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                {JSON.stringify(user, null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold">Profile Object:</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                {JSON.stringify(profile, null, 2)}
              </pre>
            </div>

            <div>
              <h3 className="font-semibold">Admin Status Checks:</h3>
              <div className="space-y-2">
                <p>Email: <strong>{user?.email || 'N/A'}</strong></p>
                <p>Profile.is_admin from DB: <strong className={dbIsAdmin ? 'text-green-600' : 'text-red-600'}>{dbIsAdmin ? 'YES' : 'NO'}</strong></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}
