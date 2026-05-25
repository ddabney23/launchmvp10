import Messages from '@/views/Messages'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function MessagesPage() {
  return (
    <ProtectedRoute>
      <Messages />
    </ProtectedRoute>
  )
}

