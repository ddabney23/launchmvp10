import Stripe from 'stripe'

const STRIPE_API_VERSION = '2025-10-29.clover'

let stripeClient: Stripe | null = null
let stripeClientKey: string | null = null

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    return null
  }

  if (!stripeClient || stripeClientKey !== secretKey) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION,
    })
    stripeClientKey = secretKey
  }

  return stripeClient
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}
