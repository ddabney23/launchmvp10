/**
 * Integration Tests for API Routes
 * 
 * Tests the Next.js API routes end-to-end
 */

import { describe, it, expect, beforeAll } from 'vitest'

describe('API Routes Integration Tests', () => {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  
  describe('Health Check API', () => {
    it('should return health status', async () => {
      const response = await fetch(`${baseUrl}/api/health`)
      const data = await response.json()
      
      expect(response.status).toBe(200)
      expect(data).toHaveProperty('status')
      expect(data).toHaveProperty('checks')
      expect(data.checks).toHaveProperty('supabase')
    })
  })

  describe('Payment API', () => {
    it('should require authentication for payment intent creation', async () => {
      const response = await fetch(`${baseUrl}/api/payment/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: 'test-order-id',
          amount: 1000,
        }),
      })
      
      // Should be unauthorized without auth token
      expect(response.status).toBe(401)
    })
  })

  describe('Bookings API', () => {
    it('should require authentication for booking creation', async () => {
      const response = await fetch(`${baseUrl}/api/bookings/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          listing_id: 'test-listing',
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + 3600000).toISOString(),
        }),
      })
      
      // Should be unauthorized without auth token
      expect(response.status).toBe(401)
    })
  })

  describe('Webhook Logs API', () => {
    it('should require admin auth for webhook logs', async () => {
      const response = await fetch(`${baseUrl}/api/webhooks/logs`)
      
      // Should be unauthorized without auth token
      expect(response.status).toBe(401)
    })
  })
})

