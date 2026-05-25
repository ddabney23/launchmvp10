import Settings from '@/views/Settings'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <Settings />
    </ProtectedRoute>
  )
}

