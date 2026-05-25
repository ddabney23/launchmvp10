import Groups from '@/views/Groups'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function GroupsPage() {
  return (
    <ProtectedRoute>
      <Groups />
    </ProtectedRoute>
  )
}

