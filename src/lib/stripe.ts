import Stripe from 'stripe'

const STRIPE_API_VERSION: Stripe.StripeConfig['apiVersion'] = '2025-10-29.clover'

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    return null
  }

  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  })
}

