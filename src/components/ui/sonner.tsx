import { Toaster as Sonner } from 'sonner'

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast: 'bg-surface-2 border border-border text-foreground font-sans',
          description: 'text-muted',
        },
      }}
    />
  )
}
