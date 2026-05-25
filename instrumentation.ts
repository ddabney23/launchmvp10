export async function register() {
  // TEMPORARILY DISABLED: Debugging startup hang
  // if (process.env.NEXT_RUNTIME === 'nodejs') {
  //   await import('./sentry.server.config')
  // }

  // if (process.env.NEXT_RUNTIME === 'edge') {
  //   await import('./sentry.edge.config')
  // }
  console.log('Instrumentation register() called - Sentry temporarily disabled')
}

export const onRequestError = async (err: Error, request: Request) => {
  await import('@sentry/nextjs').then((Sentry) => {
    Sentry.captureException(err, {
      contexts: {
        request: {
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
        },
      },
    })
  })
}
