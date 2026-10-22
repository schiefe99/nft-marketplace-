import { createRootRouteWithContext, createRoute, createRouter, lazyRouteComponent, Outlet, redirect } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { ensureSession } from '@/features/auth/session'
import { sessionStore } from '@/lib/session-store'
import { validateCatalogSearch } from '@/features/catalog/search'
import { RootLayout } from '@/routes/root-layout'
import { HomePage } from '@/routes/home'
import { NotFoundPage } from '@/routes/not-found'

export interface RouterContext {
  queryClient: QueryClient
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
})

/** Guarda das rotas privadas: aguarda a recuperação da sessão e preserva o destino. */
async function requireAuth({ location }: { location: { href: string } }) {
  await ensureSession()
  if (sessionStore.get().status !== 'authenticated') {
    throw redirect({ to: '/login', search: { redirect: location.href } })
  }
}

const authSearch = (s: Record<string, unknown>): { redirect?: string; reason?: 'expired' } => ({
  redirect: typeof s.redirect === 'string' ? s.redirect : undefined,
  reason: s.reason === 'expired' ? ('expired' as const) : undefined,
})

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', validateSearch: validateCatalogSearch, component: HomePage })

const marketRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/mercado',
  validateSearch: validateCatalogSearch,
  component: lazyRouteComponent(() => import('@/routes/market'), 'MarketPage'),
})

const nftRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/nft/$nftId',
  component: lazyRouteComponent(() => import('@/routes/nft-detail'), 'NftDetailPage'),
})

const cartRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/carrinho',
  component: lazyRouteComponent(() => import('@/routes/cart'), 'CartPage'),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: authSearch,
  component: lazyRouteComponent(() => import('@/routes/auth'), 'LoginPage'),
})

const registerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/cadastro',
  validateSearch: authSearch,
  component: lazyRouteComponent(() => import('@/routes/auth'), 'RegisterPage'),
})

const privateRoute = createRoute({ getParentRoute: () => rootRoute, id: 'private', beforeLoad: requireAuth, component: Outlet })

const checkoutRoute = createRoute({
  getParentRoute: () => privateRoute,
  path: '/pagamento',
  component: lazyRouteComponent(() => import('@/routes/checkout'), 'CheckoutPage'),
})

const orderRoute = createRoute({
  getParentRoute: () => privateRoute,
  path: '/pedido/$orderId',
  component: lazyRouteComponent(() => import('@/routes/order'), 'OrderPage'),
})

const favoritesRoute = createRoute({
  getParentRoute: () => privateRoute,
  path: '/favoritos',
  component: lazyRouteComponent(() => import('@/routes/favorites'), 'FavoritesPage'),
})

const profileRoute = createRoute({
  getParentRoute: () => privateRoute,
  path: '/conta/perfil',
  component: lazyRouteComponent(() => import('@/routes/account'), 'ProfilePage'),
})

const walletsRoute = createRoute({
  getParentRoute: () => privateRoute,
  path: '/conta/carteiras',
  component: lazyRouteComponent(() => import('@/routes/account'), 'WalletsPage'),
})

const routeTree = rootRoute.addChildren([
  homeRoute,
  marketRoute,
  nftRoute,
  cartRoute,
  loginRoute,
  registerRoute,
  privateRoute.addChildren([checkoutRoute, orderRoute, favoritesRoute, profileRoute, walletsRoute]),
])

export function createAppRouter(queryClient: QueryClient) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultNotFoundComponent: NotFoundPage,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}

