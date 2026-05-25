import Checkout from '@/views/Checkout'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function CheckoutPage() {
  return (
    <ProtectedRoute>
      <Checkout />
    </ProtectedRoute>
  )
}

