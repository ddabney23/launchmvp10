/**
 * Unit Tests for API Functions
 * 
 * Tests the src/lib/api.ts functions with mocked Supabase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPost, updatePost, deletePost } from '@/lib/api'

const mockFetch = vi.fn()

// Create a chainable mock for Supabase queries
const createChainableMock = (finalResult: any = { data: null, error: null }) => {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve(finalResult)),
    maybeSingle: vi.fn(() => Promise.resolve(finalResult)),
    then: vi.fn((resolve) => Promise.resolve(finalResult).then(resolve)),
  };
  return chain;
};

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null
      })),
      getSession: vi.fn(() => Promise.resolve({
        data: { session: { user: { id: 'test-user-id' } } },
        error: null
      }))
    },
    from: vi.fn(() => createChainableMock())
  }
}))

describe('Post API Functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    vi.stubGlobal('fetch', mockFetch)
  })

  describe('createPost', () => {
    it('should create a post successfully', async () => {
      const mockPost = {
        id: 'test-post-id',
        content: 'Test post content',
        author: 'test-user-id',
        visibility: 'public'
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: mockPost }), { status: 200 })
      )

      const result = await createPost({
        author: 'test-user-id',
        content: 'Test post content',
        visibility: 'public',
        media_urls: []
      })
      
      expect(result).toBeDefined()
      expect(result.content).toBe('Test post content')
      expect(result.author).toBe('test-user-id')
    })

    it('should throw error when not authenticated', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      )

      await expect(createPost({
        author: 'test-user-id',
        content: 'Test',
        visibility: 'public',
        media_urls: []
      })).rejects.toThrow()
    })
  })

  describe('updatePost', () => {
    it('should update own post successfully', async () => {
      const mockPost = {
        id: 'test-post-id',
        content: 'Updated content',
        author: 'test-user-id'
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: mockPost }), { status: 200 })
      )

      const result = await updatePost('test-post-id', { content: 'Updated content' })
      
      expect(result).toBeDefined()
      expect(result.content).toBe('Updated content')
    })
  })

  describe('deletePost', () => {
    it('should delete own post successfully', async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }))

      await expect(deletePost('test-post-id')).resolves.not.toThrow()
    })
  })
})

