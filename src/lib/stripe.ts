import Stripe from 'stripe'

const STRIPE_API_VERSION: Stripe.LatestApiVersion = '2025-10-29.clover'

let stripeClient: Stripe | null = null

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    return null
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION,
    })
  }

  return stripeClient
}

export function getStripeClientOrThrow(): Stripe {
  const stripe = getStripeClient()

  if (!stripe) {
    throw new Error('STRIPE_SECRET_KEY is not configured')
  }

  return stripe
}
