'use client'

import React from 'react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'
import { AlertCircle, Home, RefreshCw } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error Boundary caught:', error, errorInfo)
    
    // Handle ChunkLoadError specifically - reload the page
    if (error.name === 'ChunkLoadError' || error.message.includes('ChunkLoadError') || error.message.includes('Loading chunk')) {
      console.warn('ChunkLoadError detected in ErrorBoundary, reloading page...')
      // Small delay to ensure error is logged
      setTimeout(() => {
        window.location.reload()
      }, 1000)
      return
    }
    
    // Send to Sentry with full context
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      tags: {
        errorBoundary: true,
      },
    })
    
    this.setState({ errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-md space-y-8 text-center">
            {/* Error Icon */}
            <div className="flex justify-center">
              <AlertCircle className="h-24 w-24 text-red-500" />
            </div>
            
            {/* Error Message */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-gray-900">
                Oops! Something went wrong
              </h1>
              <p className="text-gray-600">
                We're sorry for the inconvenience. Our team has been notified.
              </p>
            </div>

            {/* Development-only error details */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-4 rounded-lg bg-red-50 p-4 text-left">
                <p className="text-sm font-semibold text-red-800">
                  Error Details (Development Only):
                </p>
                <pre className="mt-2 max-h-64 overflow-auto text-xs text-red-700">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                onClick={this.handleReset}
                variant="default"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button
                onClick={this.handleGoHome}
                variant="outline"
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Go Home
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
