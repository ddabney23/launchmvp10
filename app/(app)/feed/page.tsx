import Feed from '@/views/Feed'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function FeedPage() {
  return (
    <ProtectedRoute>
      <Feed />
    </ProtectedRoute>
  )
}

