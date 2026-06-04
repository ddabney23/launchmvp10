import { Shippo } from 'shippo'

let shippoClient: Shippo | null = null
let shippoClientKey: string | null = null

export function getShippoClient(): Shippo | null {
  const apiKey = process.env.SHIPPO_API_KEY

  if (!apiKey) {
    return null
  }

  if (!shippoClient || shippoClientKey !== apiKey) {
    shippoClient = new Shippo({ apiKeyHeader: apiKey })
    shippoClientKey = apiKey
  }

  return shippoClient
}
