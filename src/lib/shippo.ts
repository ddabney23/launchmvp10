import { Shippo } from 'shippo'

let shippoClient: Shippo | null = null

export function getShippoClient(): Shippo | null {
  const apiKey = process.env.SHIPPO_API_KEY?.trim()

  if (!apiKey) {
    return null
  }

  shippoClient ??= new Shippo({
    apiKeyHeader: apiKey,
  })

  return shippoClient
}
