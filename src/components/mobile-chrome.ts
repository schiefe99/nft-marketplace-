import { useRouterState } from '@tanstack/react-router'

/**
 * Telas mobile seguem os frames "Mobile / *": catálogo com busca no topo e abas
 * inferiores; detalhe, carrinho, pagamento e login são telas cheias com "voltar".
 */
export function useMobileChrome() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const search = pathname === '/' || pathname.startsWith('/mercado')
  return { search, tabs: search || pathname.startsWith('/favoritos') || pathname.startsWith('/conta') }
}
