import { cn } from '@/lib/utils'

/** Skeleton com shimmer; sem brilho com prefers-reduced-motion. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      data-testid="skeleton"
      className={cn(
        'animate-shimmer rounded-md bg-surface bg-linear-to-r from-transparent via-accent/10 to-transparent bg-size-[400px_100%] bg-no-repeat',
        'motion-reduce:animate-none motion-reduce:bg-none',
        className,
      )}
      {...props}
    />
  )
}
