import { createHmac, timingSafeEqual } from 'crypto'

function timingSafeHexEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'hex')
  const bBuffer = Buffer.from(b, 'hex')

  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer)
}

export function verifyShippoSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  const signatureParts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, ...valueParts] = part.trim().split('=')
      return [key, valueParts.join('=')]
    })
  )

  const timestamp = signatureParts.t
  const signature = signatureParts.v1 ?? signatureHeader
  const signedPayload = timestamp ? `${timestamp}.${rawBody}` : rawBody
  const expectedSignature = createHmac('sha256', secret).update(signedPayload).digest('hex')

  return timingSafeHexEqual(signature, expectedSignature)
}
