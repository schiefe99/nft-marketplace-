import { Toaster as Sonner } from 'sonner'
import { useIsMobile } from '@/lib/use-media'

export function Toaster() {
  // no celular as barras fixas ficam embaixo (abas, compra, pagamento): avisos aparecem no topo
  const isMobile = useIsMobile()
  return (
    <Sonner
      theme="dark"
      position={isMobile ? 'top-center' : 'bottom-right'}
      closeButton
      duration={3500}
      visibleToasts={2}
      toastOptions={{
        classNames: {
          toast: 'bg-surface-2 border border-border text-foreground font-sans',
          description: 'text-muted',
        },
      }}
    />
  )
}
