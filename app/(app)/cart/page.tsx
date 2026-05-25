import Cart from '@/views/Cart'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function CartPage() {
  return (
    <ProtectedRoute>
      <Cart />
    </ProtectedRoute>
  )
}

