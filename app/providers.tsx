'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CartProvider } from '@/contexts/CartContext'
import { ThemeProvider } from '@/contexts/ThemeProvider'
import { AuthProvider } from '@/contexts/AuthContext'
import { SocialProvider } from '@/contexts/SocialContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error: unknown) => {
          if (error && typeof error === 'object' && 'status' in error) {
            const status = (error as any).status
            if (typeof status === 'number' && status >= 400 && status < 500) {
              return false
            }
          }
          return failureCount < 3
        },
        staleTime: 5 * 60 * 1000,
      },
    },
  }))

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SocialProvider>
              <CartProvider>
                <TooltipProvider>
                  <Toaster />
                  <Sonner />
                  {children}
                </TooltipProvider>
              </CartProvider>
            </SocialProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

