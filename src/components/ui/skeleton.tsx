import { cn } from '@/lib/utils'

/** Skeleton com shimmer; respeita prefers-reduced-motion (ver index.css). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" data-testid="skeleton" className={cn('skeleton rounded-md', className)} {...props} />
}
