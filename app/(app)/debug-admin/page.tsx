'use client'

import { useAuth } from '@/hooks/useAuth'
import { isAdminEmail } from '@/lib/admin'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DebugAdminPage() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  const emailIsAdmin = user?.email ? isAdminEmail(user.email) : false
  const dbIsAdmin = profile?.is_admin || false
  const finalIsAdmin = dbIsAdmin || emailIsAdmin

  return (
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
              <p>Email is in admin whitelist: <strong className={emailIsAdmin ? 'text-green-600' : 'text-red-600'}>{emailIsAdmin ? 'YES ✓' : 'NO ✗'}</strong></p>
              <p>Profile.is_admin from DB: <strong className={dbIsAdmin ? 'text-green-600' : 'text-red-600'}>{dbIsAdmin ? 'YES ✓' : 'NO ✗'}</strong></p>
              <p>Final Admin Status: <strong className={finalIsAdmin ? 'text-green-600' : 'text-red-600'}>{finalIsAdmin ? 'YES ✓' : 'NO ✗'}</strong></p>
            </div>
          </div>

          <div>
            <h3 className="font-semibold">Hardcoded Admin Emails:</h3>
            <ul className="list-disc list-inside">
              <li>ddabney23@gmail.com</li>
              <li>*@admin*</li>
              <li>admin@*</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
