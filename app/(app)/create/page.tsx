import CreatePost from '@/views/CreatePost'
import { ProtectedRoute } from '@/components/ProtectedRoute'

export default function CreatePostPage() {
  return (
    <ProtectedRoute>
      <CreatePost />
    </ProtectedRoute>
  )
}

