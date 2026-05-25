/**
 * Unit Tests for Utility Functions
 */

import { describe, it, expect } from 'vitest'
import { getErrorMessage, getErrorStatus, getDetailedError } from '@/lib/error-utils'
import { sanitizeString, sanitizeHtml } from '@/lib/sanitize'

describe('Error Utils', () => {
  describe('getErrorMessage', () => {
    it('should extract message from Error object', () => {
      const error = new Error('Test error')
      expect(getErrorMessage(error)).toBe('Test error')
    })

    it('should handle string errors', () => {
      expect(getErrorMessage('String error')).toBe('String error')
    })

    it('should handle unknown error types', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred')
      expect(getErrorMessage(undefined)).toBe('An unexpected error occurred')
      expect(getErrorMessage(123)).toBe('An unexpected error occurred')
    })

    it('should handle objects with message property', () => {
      expect(getErrorMessage({ message: 'Object error' })).toBe('Object error')
    })
  })

  describe('getErrorStatus', () => {
    it('should extract status from error object', () => {
      expect(getErrorStatus({ status: 404 })).toBe(404)
      expect(getErrorStatus({ statusCode: 500 })).toBe(500)
    })

    it('should return undefined for errors without status', () => {
      expect(getErrorStatus(new Error('test'))).toBeUndefined()
      expect(getErrorStatus('test')).toBeUndefined()
    })
  })

  describe('getDetailedError', () => {
    it('should return auth error for 401 status', () => {
      const result = getDetailedError({ status: 401, message: 'Unauthorized' })
      expect(result.title).toBe('Authentication Required')
      expect(result.action).toBe('Sign In')
    })

    it('should return permission error for 403 status', () => {
      const result = getDetailedError({ status: 403, message: 'Forbidden' })
      expect(result.title).toBe('Permission Denied')
    })

    it('should return not found error for 404 status', () => {
      const result = getDetailedError({ status: 404, message: 'Not found' })
      expect(result.title).toBe('Not Found')
    })
  })
})

describe('Sanitize Utils', () => {
  describe('sanitizeString', () => {
    it('should remove HTML tags', () => {
      // sanitizeString removes tags, then escapes the remaining content
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('alert(&quot;xss&quot;)')
      expect(sanitizeString('<b>Bold</b> text')).toBe('Bold text')
    })

    it('should handle normal text', () => {
      expect(sanitizeString('Hello World')).toBe('Hello World')
    })
  })

  describe('sanitizeHtml', () => {
    it('should allow safe HTML tags', () => {
      const html = '<p>Hello</p><strong>World</strong>'
      const result = sanitizeHtml(html)
      expect(result).toContain('<p>')
      expect(result).toContain('<strong>')
    })

    it('should remove dangerous tags', () => {
      const result = sanitizeHtml('<script>alert("xss")</script><p>Safe</p>')
      expect(result).not.toContain('<script>')
      expect(result).toContain('<p>')
    })
  })
})

