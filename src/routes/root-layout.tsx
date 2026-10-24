import { Outlet, useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect } from 'react'
import { toast } from 'sonner'
import { Footer, Header, MobileTabBar } from '@/components/layout'
import { useMobileChrome } from '@/components/mobile-chrome'
import { cn } from '@/lib/utils'
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

/** Feedback discreto de navegação: barra fina no topo enquanto a próxima rota carrega. */
function RouteProgress() {
  const loading = useRouterState({ select: (s) => s.status === 'pending' })
  if (!loading) return null
  return (
    <div role="progressbar" aria-label="Carregando página" className="fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden bg-primary/20">
      <div className="h-full animate-route-progress w-2/5 bg-primary" />
    </div>
  )
}

/** Painel de mocks é ferramenta de demonstração: aparece só com `?mocks` na URL (lembrado na aba). */
function mockPanelEnabled() {
  try {
    if (new URLSearchParams(window.location.search).has('mocks')) sessionStorage.setItem('kurio-mocks-panel', '1')
    return sessionStorage.getItem('kurio-mocks-panel') === '1'
  } catch {
    return false
  }
}

export function RootLayout() {
  const { tabs } = useMobileChrome()
  return (
    <>
      <RouteProgress />
      <SessionEffects />
      <RealtimeNotifier />
      <Header />
      <main id="conteudo" tabIndex={-1} className={cn('outline-none', tabs && 'max-md:pb-24')}>
        <Outlet />
      </main>
      <Footer />
      <MobileTabBar />
      <Toaster />
      {window.__mocks && mockPanelEnabled() && (
        <Suspense fallback={null}>
          <MockPanel />
        </Suspense>
      )}
    </>
  )
}
