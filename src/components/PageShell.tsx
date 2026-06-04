import { cn } from '@/lib/utils'

interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <main className={cn('container mx-auto max-w-7xl px-4 pt-20 pb-20 md:pt-24 md:pb-8', className)}>
      {children}
    </main>
  )
}
