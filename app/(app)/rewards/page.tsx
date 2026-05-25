import Rewards from '@/views/Rewards'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function RewardsPage() {
  return (
    <ProtectedRoute>
      <Rewards />
    </ProtectedRoute>
  )
}

