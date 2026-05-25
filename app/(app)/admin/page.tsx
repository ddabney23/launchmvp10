// CLERK AUTH: Admin page protected with Clerk authentication
import AdminDashboard from '@/views/AdminDashboard'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function AdminPage() {
  return (
    <ProtectedRoute requireAdmin>
      <AdminDashboard />
    </ProtectedRoute>
  )
}

