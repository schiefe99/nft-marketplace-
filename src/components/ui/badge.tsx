import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold', {
  variants: {
    variant: {
      default: 'bg-primary/20 text-accent',
      success: 'bg-success/15 text-success',
      danger: 'bg-danger/15 text-danger',
      warning: 'bg-warning/15 text-warning',
      neutral: 'bg-foreground/10 text-foreground',
    },
  },
  defaultVariants: { variant: 'default' },
})

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
