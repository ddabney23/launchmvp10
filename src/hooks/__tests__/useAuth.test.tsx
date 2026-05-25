import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAuth } from '../useAuth'
import { createClient } from '@/lib/supabase/client'
import { getProfile } from '@/lib/api'

vi.mock('@/lib/supabase/client')
vi.mock('@/lib/api', () => ({
  getProfile: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}))

const TEST_USER_ID = '00000000-0000-0000-0000-000000000001'

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const mockClient = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: TEST_USER_ID,
                email: 'test@example.com',
                email_confirmed_at: new Date().toISOString(),
                user_metadata: {},
              },
            },
          },
        }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signOut: vi.fn().mockResolvedValue({ error: null }),
      },
    }
    vi.mocked(createClient).mockReturnValue(mockClient as ReturnType<typeof createClient>)
  })

  it('should initialize with loading state', () => {
    vi.mocked(createClient).mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn(() => ({
          data: { subscription: { unsubscribe: vi.fn() } },
        })),
        signOut: vi.fn(),
      },
    } as ReturnType<typeof createClient>)

    const { result } = renderHook(() => useAuth())
    expect(result.current.loading).toBe(true)
  })

  it('should set user when session exists', async () => {
    const mockProfile = {
      id: TEST_USER_ID,
      username: 'testuser',
      display_name: 'Test User',
    }

    vi.mocked(getProfile).mockResolvedValue(mockProfile as Awaited<ReturnType<typeof getProfile>>)

    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.user?.id).toBe(TEST_USER_ID)
    expect(result.current.user?.email).toBe('test@example.com')
    expect(result.current.profile).toEqual(mockProfile)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('should handle sign out', async () => {
    const { result } = renderHook(() => useAuth())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.signOut).toBeDefined()
    expect(typeof result.current.signOut).toBe('function')
  })
})
