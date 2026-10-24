import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  // seta "anda" no hover, como nos CTAs da versão viva
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-bold tracking-[0.04em] transition-[color,background-color,border-color,box-shadow,translate] duration-200 disabled:pointer-events-none disabled:opacity-50 aria-disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0 [&_.lucide-arrow-right]:transition-transform hover:[&_.lucide-arrow-right]:translate-x-1',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_10px_28px_-12px_var(--color-primary)] hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_18px_38px_-12px_var(--color-primary)] active:translate-y-0',
        outline: 'border border-primary bg-transparent text-accent hover:bg-primary/10',
        secondary: 'bg-surface text-foreground border border-border hover:border-border-soft',
        ghost: 'bg-transparent text-foreground hover:bg-foreground/5',
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
