import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PostCard } from '../PostCard'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the API functions
vi.mock('@/lib/api', () => ({
  getProfile: vi.fn(),
  getLikeCount: vi.fn(() => Promise.resolve(5)),
  isLiked: vi.fn(() => Promise.resolve(false)),
  getPostComments: vi.fn(() => Promise.resolve([])),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('PostCard', () => {
  it('should render post content', () => {
    const post = {
      id: '1',
      author: 'user1',
      content: 'Test post content',
      media_urls: [],
      visibility: 'public' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    render(<PostCard post={post} />, { wrapper: createWrapper() })
    
    expect(screen.getByText('Test post content')).toBeInTheDocument()
  })

  it('should render media when present', () => {
    const post = {
      id: '1',
      author: 'user1',
      content: 'Test post with image',
      media_urls: ['https://example.com/image.jpg'],
      visibility: 'public' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    render(<PostCard post={post} />, { wrapper: createWrapper() })
    
    const image = screen.getByRole('img')
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg')
  })
})

