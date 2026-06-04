import { createHmac } from 'crypto'
import { describe, expect, it } from 'vitest'
import { verifyShippoSignature } from '@/lib/shippo-webhook'

describe('verifyShippoSignature', () => {
  it('validates Shippo timestamped HMAC signatures', () => {
    const rawBody = JSON.stringify({ event: 'track_updated', tracking_number: 'TRACK123' })
    const timestamp = '1688493073'
    const secret = 'shippo_test_secret'
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex')

    expect(verifyShippoSignature(rawBody, `t=${timestamp},v1=${signature}`, secret)).toBe(true)
  })

  it('rejects invalid signatures', () => {
    const rawBody = JSON.stringify({ event: 'track_updated' })

    expect(verifyShippoSignature(rawBody, 't=1688493073,v1=deadbeef', 'shippo_test_secret')).toBe(false)
  })
})
