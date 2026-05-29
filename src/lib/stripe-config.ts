/**
 * Stripe env helpers — supports both naming conventions in .env files.
 */

export function getStripeSecretKey(): string | undefined {
  return process.env.STRIPE_SECRET_KEY?.trim() || undefined
}

export function getStripePublishableKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY?.trim() ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() ||
    undefined
  )
}

export function isStripeConfigured(): boolean {
  return Boolean(getStripeSecretKey() && getStripePublishableKey())
}

export function stripeConfigErrorMessage(): string {
  const missing: string[] = []
  if (!getStripeSecretKey()) missing.push('STRIPE_SECRET_KEY')
  if (!getStripePublishableKey()) {
    missing.push('NEXT_PUBLIC_STRIPE_PUBLIC_KEY (or NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)')
  }
  return `Payment is not configured. Set ${missing.join(' and ')} in .env.local (see env.example.txt).`
}
