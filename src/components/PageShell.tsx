import { cn } from '@/lib/utils'

interface PageShellProps {
  children: React.ReactNode
  className?: string
  /** Use max-w-4xl for article-style pages */
  narrow?: boolean
}

export function PageShell({ children, className, narrow }: PageShellProps) {
  return (
    <main
      className={cn(
        'container mx-auto px-4 pt-16 md:pt-24 pb-16 md:pb-8 py-6',
        narrow ? 'max-w-4xl' : 'max-w-7xl',
        className
      )}
    >
      {children}
    </main>
  )
}
