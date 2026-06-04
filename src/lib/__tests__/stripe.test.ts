import { afterEach, describe, expect, it, vi } from 'vitest'

describe('Stripe client helper', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('returns null instead of throwing when Stripe is not configured', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '')
    const { getStripeClient, isStripeConfigured } = await import('@/lib/stripe')

    expect(isStripeConfigured()).toBe(false)
    expect(getStripeClient()).toBeNull()
  })

  it('creates and caches a client when Stripe is configured', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_123')
    const { getStripeClient, isStripeConfigured } = await import('@/lib/stripe')

    const firstClient = getStripeClient()
    const secondClient = getStripeClient()

    expect(isStripeConfigured()).toBe(true)
    expect(firstClient).not.toBeNull()
    expect(secondClient).toBe(firstClient)
  })
})
