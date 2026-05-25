import Home from '@/views/Home'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function HomePage() {
  return (
    <ProtectedRoute>
      <Home />
    </ProtectedRoute>
  )
}

