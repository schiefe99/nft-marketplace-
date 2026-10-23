import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-bold tracking-[0.04em] transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        outline: 'border border-primary bg-transparent text-accent hover:bg-primary/10',
        secondary: 'bg-surface text-foreground border border-border hover:border-border-soft',
        ghost: 'bg-transparent text-foreground hover:bg-white/5',
        danger: 'bg-transparent border border-danger text-danger hover:bg-danger/10',
        link: 'bg-transparent text-primary underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        default: 'h-12 px-8 text-sm',
        md: 'h-11 px-6 text-sm',
        sm: 'h-9 px-4 text-xs [&_svg]:size-4',
        icon: 'size-11 rounded-md',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, type, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...(asChild ? {} : { type: type ?? 'button' })} {...props} />
})
Button.displayName = 'Button'

export { buttonVariants }
