import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Home from '../Home'
import { useAuth } from '@/hooks/useAuth'

vi.mock('@/hooks/useAuth')
vi.mock('@/contexts/CartContext', () => ({
  useCart: vi.fn(() => ({
    items: [],
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
    clearCart: vi.fn(),
    getItemCount: vi.fn(() => 0),
    total: 0,
  })),
}))
vi.mock('@/lib/api', () => ({
  getPersonalizedFeed: vi.fn(() => Promise.resolve([])),
  getRecommendedListings: vi.fn(() => Promise.resolve([])),
  getRecommendedVendors: vi.fn(() => Promise.resolve([])),
  getProfile: vi.fn(() => Promise.resolve(null)),
  getLeaderboard: vi.fn(() => Promise.resolve([])),
  getUserBadges: vi.fn(() => Promise.resolve([])),
  getFollowing: vi.fn(() => Promise.resolve([])),
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

describe('Home Page', () => {
  it('should render welcome message for authenticated user', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: '00000000-0000-0000-0000-000000000001',
        email: 'test@example.com',
        emailVerified: true,
      },
      profile: { display_name: 'Test User', username: 'testuser' } as never,
      loading: false,
      signOut: vi.fn(),
      session: null,
      isAuthenticated: true,
      getProfileUuid: vi.fn(),
      refetch: vi.fn(),
      setProfile: vi.fn(),
      mergeProfile: vi.fn(),
    })

    render(<Home />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/Welcome back/i)).toBeInTheDocument()
    })
  })

  it('should show loading state initially', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      profile: null,
      loading: true,
      signOut: vi.fn(),
      session: null,
      isAuthenticated: false,
      getProfileUuid: vi.fn(),
      refetch: vi.fn(),
      setProfile: vi.fn(),
      mergeProfile: vi.fn(),
    })

    const { container } = render(<Home />, { wrapper: createWrapper() })
    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })
})
