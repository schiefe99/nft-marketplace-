import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Dialog/Sheet do shadcn (Radix): foco preso, Esc fecha, foco devolvido ao gatilho. */
export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

const Overlay = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Overlay>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Overlay ref={ref} className={cn('fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-overlay-in', className)} {...props} />,
)
Overlay.displayName = 'DialogOverlay'

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { side?: 'center' | 'right' | 'left' }
>(({ className, children, side = 'center', ...props }, ref) => (
  <DialogPrimitive.Portal>
    <Overlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 bg-surface border border-border text-foreground shadow-2xl outline-none',
        side === 'center' && 'left-1/2 top-1/2 w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg p-6 md:p-10 max-h-[calc(100dvh-32px)] overflow-y-auto data-[state=open]:animate-dialog-in',
        side === 'right' && 'inset-y-0 right-0 flex h-full w-[min(380px,100%)] flex-col overflow-y-auto p-6 data-[state=open]:animate-sheet-right',
        side === 'left' && 'inset-y-0 left-0 flex h-full w-[min(340px,100%)] flex-col overflow-y-auto p-6 data-[state=open]:animate-sheet-left',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-2 text-muted hover:bg-foreground/10 hover:text-foreground" aria-label="Fechar">
        <X className="size-5" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = 'DialogContent'

export const DialogTitle = React.forwardRef<React.ElementRef<typeof DialogPrimitive.Title>, React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>>(
  ({ className, ...props }, ref) => <DialogPrimitive.Title ref={ref} className={cn('pr-8 text-2xl font-bold', className)} {...props} />,
)
DialogTitle.displayName = 'DialogTitle'

export const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => <DialogPrimitive.Description ref={ref} className={cn('mt-2 text-muted', className)} {...props} />)
DialogDescription.displayName = 'DialogDescription'
