import Stripe from 'stripe'

const STRIPE_API_VERSION = '2025-10-29.clover'

let stripeClient: Stripe | null = null
let configuredSecret: string | null = null

export function getStripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    return null
  }

  if (!stripeClient || configuredSecret !== secretKey) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: STRIPE_API_VERSION,
    })
    configuredSecret = secretKey
  }

  return stripeClient
}

export function getStripeWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET || null
}
