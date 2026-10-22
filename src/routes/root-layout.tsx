import { Outlet, useNavigate, useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect } from 'react'
import { toast } from 'sonner'
import { Footer, Header, MobileTabBar } from '@/components/layout'
import { Toaster } from '@/components/ui/sonner'
import { clearPrivateCache, ensureSession } from '@/features/auth/session'
import { sessionStore, useSession } from '@/lib/session-store'
import { realtime } from '@/realtime/realtime'
import { PRIVATE_PREFIXES } from '@/lib/session-store'

const MockPanel = lazy(() => import('@/mocks/panel'))

/** Efeitos de sessão: recuperação, socket por usuário, limpeza no logout/expiração. */
function SessionEffects() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const { status, token, user } = useSession()

  useEffect(() => {
    void ensureSession()
  }, [])

  // Um socket por sessão; trocar de usuário encerra o anterior (sem vazamento de eventos)
  useEffect(() => {
    if (status === 'unknown') return
    realtime.connect(qc, token, user?.id ?? null)
    return () => realtime.disconnect()
  }, [qc, status, token, user?.id])

  useEffect(
    () =>
      sessionStore.onEnd((prevUserId, reason) => {
        clearPrivateCache(qc, prevUserId)
        const { pathname, href } = router.state.location
        if (reason === 'expired') {
          toast.warning('Sua sessão expirou. Entre novamente para continuar de onde parou.')
          if (PRIVATE_PREFIXES.some((p) => pathname.startsWith(p))) {
            void navigate({ to: '/login', search: { redirect: href, reason: 'expired' } })
          }
        }
      }),
    [qc, navigate, router],
  )

  return null
}

/** Feedback acessível (toasts com aria-live) para alterações em tempo real. */
function RealtimeNotifier() {
  useEffect(
    () =>
      realtime.on((e) => {
        if (e.type === 'nft.changed' && e.inCart && (e.priceChanged || e.availabilityChanged)) {
          toast.warning(`${e.name || 'Um item do seu carrinho'} foi atualizado`, {
            description: e.priceChanged ? 'O preço mudou. Revise o resumo antes de finalizar.' : 'A disponibilidade mudou. Revise as quantidades.',
            id: `nft-${e.nftId}`,
          })
        }
        if (e.type === 'order.changed') {
          if (e.order.status === 'confirmed') toast.success('Pagamento confirmado! Seus NFTs estão na sua carteira.', { id: `order-${e.order.id}` })
          if (e.order.status === 'declined') toast.error('Pagamento recusado.', { description: e.order.failureReason ?? undefined, id: `order-${e.order.id}` })
        }
      }),
    [],
  )
  return null
}

export function RootLayout() {
  return (
    <>
      <SessionEffects />
      <RealtimeNotifier />
      <Header />
      <main id="conteudo" tabIndex={-1} className="outline-none">
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
      <Toaster />
      {window.__mocks && (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      )}
    </>
  )
}
