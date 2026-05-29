'use client'

import { useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { loadStripe, type StripeElementsOptions } from '@stripe/stripe-js'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { getStripePublishableKey } from '@/lib/stripe-config'

const stripePromise = (() => {
  const key = getStripePublishableKey()
  return key ? loadStripe(key) : null
})()

interface StripePaymentFormInnerProps {
  returnUrl: string
  onSuccess?: () => void
  onError?: (message: string) => void
  submitLabel?: string
}

function StripePaymentFormInner({
  returnUrl,
  onSuccess,
  onError,
  submitLabel = 'Pay now',
}: StripePaymentFormInnerProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return

    setProcessing(true)
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
      redirect: 'if_required',
    })

    setProcessing(false)

    if (error) {
      onError?.(error.message ?? 'Payment failed')
      return
    }

    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      <Button type="submit" className="w-full" disabled={!stripe || processing}>
        {processing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  )
}

export interface StripePaymentFormProps {
  clientSecret: string
  returnUrl: string
  onSuccess?: () => void
  onError?: (message: string) => void
  submitLabel?: string
}

export function StripePaymentForm({
  clientSecret,
  returnUrl,
  onSuccess,
  onError,
  submitLabel,
}: StripePaymentFormProps) {
  if (!stripePromise) {
    return (
      <p className="text-sm text-destructive">
        Stripe publishable key is not configured.
      </p>
    )
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: { theme: 'stripe' },
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <StripePaymentFormInner
        returnUrl={returnUrl}
        onSuccess={onSuccess}
        onError={onError}
        submitLabel={submitLabel}
      />
    </Elements>
  )
}
