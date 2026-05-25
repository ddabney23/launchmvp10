import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { supabase } from '@/integrations/supabase/client'
import { getProfile, createPost, like, unlike, getLikeCount, isLiked } from '@/lib/api'
import { ApiError } from '@/lib/types'

const createChainableMock = (finalResult: { data?: unknown; error?: unknown; count?: number } = { data: null, error: null }) => {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    neq: vi.fn(() => chain),
    gt: vi.fn(() => chain),
    lt: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    like: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    is: vi.fn(() => chain),
    in: vi.fn(() => chain),
    contains: vi.fn(() => chain),
    containedBy: vi.fn(() => chain),
    rangeGt: vi.fn(() => chain),
    rangeLt: vi.fn(() => chain),
    rangeGte: vi.fn(() => chain),
    rangeLte: vi.fn(() => chain),
    rangeAdjacent: vi.fn(() => chain),
    overlaps: vi.fn(() => chain),
    filter: vi.fn(() => chain),
    match: vi.fn(() => chain),
    not: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    range: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(finalResult)),
    maybeSingle: vi.fn(() => Promise.resolve(finalResult)),
    then: vi.fn((resolve) => Promise.resolve(finalResult).then(resolve)),
  }
  return chain
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'test-user-id' } }, error: null })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: { user: { id: 'test-user-id' } } }, error: null })),
    },
    from: vi.fn(() => createChainableMock()),
  },
}))

describe('API Functions', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('getProfile', () => {
    it('should return profile data when successful', async () => {
      const mockProfile = {
        id: 'user-1',
        username: 'testuser',
        display_name: 'Test User',
      }

      vi.mocked(supabase.from).mockReturnValue(
        createChainableMock({ data: mockProfile, error: null }) as never
      )

      const result = await getProfile('user-1')
      expect(result).toEqual(mockProfile)
    })

    it('should throw ApiError when profile not found', async () => {
      vi.mocked(supabase.from).mockReturnValue(
        createChainableMock({ data: null, error: { message: 'Not found' } }) as never
      )

      await expect(getProfile('invalid-id')).rejects.toThrow(ApiError)
    })
  })

  describe('createPost', () => {
    it('should create a post successfully', async () => {
      const mockPost = {
        id: 'post-1',
        author: 'user-1',
        content: 'Test post',
        visibility: 'public',
      }

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockPost }),
      } as Response)

      const result = await createPost({
        content: 'Test post',
        visibility: 'public',
      })

      expect(result).toEqual(mockPost)
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should throw error when user is not authenticated', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      } as Response)

      await expect(
        createPost({
          content: 'Test post',
          visibility: 'public',
        })
      ).rejects.toThrow(ApiError)
    })
  })

  describe('like', () => {
    it('should like a post successfully', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response)

      const result = await like('post', 'post-1')
      expect(result.target_id).toBe('post-1')
    })
  })

  describe('unlike', () => {
    it('should unlike a post successfully', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response)

      await expect(unlike('post', 'post-1')).resolves.not.toThrow()
    })
  })

  describe('getLikeCount', () => {
    it('should return correct like count', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: { count: 2 } }),
      } as Response)

      const count = await getLikeCount('post', 'post-1')
      expect(count).toBe(2)
    })
  })

  describe('isLiked', () => {
    it('should return true when post is liked', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ isLiked: true }),
      } as Response)

      const result = await isLiked('post', 'post-1')
      expect(result).toBe(true)
    })

    it('should return false when post is not liked', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      } as Response)

      const result = await isLiked('post', 'post-1')
      expect(result).toBe(false)
    })
  })
})
