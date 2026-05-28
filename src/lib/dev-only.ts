import { NextResponse } from 'next/server'

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/** Return 404 in production for debug/diagnostic routes. */
export function productionDisabledResponse() {
  if (!isProduction()) {
    return null
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
