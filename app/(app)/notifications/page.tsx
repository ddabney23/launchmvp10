import Notifications from '@/views/Notifications'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <Notifications />
    </ProtectedRoute>
  )
}

