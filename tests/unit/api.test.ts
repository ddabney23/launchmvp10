/**
 * Unit Tests for API Functions
 * 
 * Tests the src/lib/api.ts functions with mocked Supabase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPost, updatePost, deletePost } from '@/lib/api'

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
  })

  describe('createPost', () => {
    it('should create a post successfully', async () => {
      const mockSupabase = await import('@/integrations/supabase/client')
      
      const mockProfile = {
        id: 'test-user-id',
        username: 'testuser',
        display_name: 'Test User',
      };

      const mockPost = {
        id: 'test-post-id',
        content: 'Test post content',
        author: 'test-user-id',
        visibility: 'public'
      };

      // Mock getSession
      vi.mocked(mockSupabase.supabase.auth.getSession).mockResolvedValue({
        data: { session: { user: { id: 'test-user-id' } } },
        error: null
      } as any);

      // Mock from() to return profile then post
      (mockSupabase.supabase.from as any) = vi.fn((table: string) => {
        if (table === 'profiles') {
          return createChainableMock({ data: mockProfile, error: null });
        } else if (table === 'posts') {
          return createChainableMock({ data: mockPost, error: null });
        }
        return createChainableMock();
      });

      const result = await createPost({
        content: 'Test post content',
        visibility: 'public',
        media_urls: []
      })
      
      expect(result).toBeDefined()
      expect(result.content).toBe('Test post content')
      expect(result.author).toBe('test-user-id')
    })

    it('should throw error when not authenticated', async () => {
      const mockSupabase = await import('@/integrations/supabase/client')
      
      // Mock unauthenticated state
      vi.mocked(mockSupabase.supabase.auth.getSession).mockResolvedValueOnce({
        data: { session: null },
        error: null
      } as any)

      await expect(createPost({
        content: 'Test',
        visibility: 'public',
        media_urls: []
      })).rejects.toThrow()
    })
  })

  describe('updatePost', () => {
    it('should update own post successfully', async () => {
      const mockSupabase = await import('@/integrations/supabase/client')
      
      const mockPost = {
        id: 'test-post-id',
        content: 'Updated content',
        author: 'test-user-id'
      };

      // Mock getUser for updatePost
      vi.mocked(mockSupabase.supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      } as any);

      // Mock from() for ownership check and update
      (mockSupabase.supabase.from as any) = vi.fn((table: string) => {
        if (table === 'posts') {
          return createChainableMock({ data: mockPost, error: null });
        }
        return createChainableMock();
      });

      const result = await updatePost('test-post-id', { content: 'Updated content' })
      
      expect(result).toBeDefined()
      expect(result.content).toBe('Updated content')
    })
  })

  describe('deletePost', () => {
    it('should delete own post successfully', async () => {
      const mockSupabase = await import('@/integrations/supabase/client')
      
      const mockPost = {
        id: 'test-post-id',
        author: 'test-user-id'
      };

      // Mock getUser
      vi.mocked(mockSupabase.supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null
      } as any);

      // Mock from() for ownership check and delete
      (mockSupabase.supabase.from as any) = vi.fn((table: string) => {
        if (table === 'posts') {
          return createChainableMock({ data: mockPost, error: null });
        }
        return createChainableMock();
      });

      await expect(deletePost('test-post-id')).resolves.not.toThrow()
    })
  })
})

