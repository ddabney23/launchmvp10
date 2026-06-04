import Stripe from 'stripe'

const STRIPE_API_VERSION = '2025-10-29.clover'

let stripeClient: Stripe | null = null

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim()

  if (!secretKey) {
    return null
  }

  stripeClient ??= new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  })

  return stripeClient
}
