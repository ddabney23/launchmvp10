import Orders from '@/views/Orders'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function OrdersPage() {
  return (
    <ProtectedRoute>
      <Orders />
    </ProtectedRoute>
  )
}

