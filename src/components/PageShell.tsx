import { cn } from '@/lib/utils'

interface PageShellProps {
  children: React.ReactNode
  className?: string
}

export function PageShell({ children, className }: PageShellProps) {
  return (
    <main className={cn('container mx-auto max-w-7xl px-4 py-6', className)}>
      {children}
    </main>
  )
}
