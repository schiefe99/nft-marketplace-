import type { QueryClient } from '@tanstack/react-query'
import { authApi, cartApi } from '@/api/endpoints'
import { isApiError } from '@/api/client'
import { qk } from '@/api/query'
import type { Session } from '@/contracts'
import { sessionStore } from '@/lib/session-store'

let bootstrapPromise: Promise<void> | null = null

/**
 * Recupera a sessão após refresh (GET /auth/session). Executa uma única vez;
 * rotas privadas aguardam esta promessa no `beforeLoad`.
 */
export function ensureSession(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise
  const { token } = sessionStore.get()
  if (!token) {
    bootstrapPromise = Promise.resolve()
    return bootstrapPromise
  }
  bootstrapPromise = (async () => {
    // Falhas transitórias: tenta de novo antes de desistir (sem derrubar a sessão)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const session = await authApi.session()
        sessionStore.signIn({ ...session, token })
        return
      } catch (err) {
        if (isApiError(err) && err.status === 401) {
          if (sessionStore.get().token) sessionStore.end('expired')
          return
        }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
      }
    }
    // Sem conexão: mantém o token e segue como anônimo até reconectar
    sessionStore.end('expired')
  })()
  return bootstrapPromise
}

/** Após autenticar: limpa dados privados de outro usuário e preserva o carrinho do visitante. */
export async function completeSignIn(qc: QueryClient, session: Session) {
  const prevUser = sessionStore.get().user?.id
  if (prevUser && prevUser !== session.user.id) qc.removeQueries({ queryKey: ['private'] })
  sessionStore.signIn(session)
  bootstrapPromise = Promise.resolve()
  try {
    const merged = await cartApi.merge()
    qc.setQueryData(qk.cart(session.user.id), merged)
  } catch {
    void qc.invalidateQueries({ queryKey: ['cart'] })
  }
  qc.removeQueries({ queryKey: ['cart'], predicate: (q) => q.queryKey[1] !== session.user.id })
}

export async function signOut(qc: QueryClient) {
  try {
    await authApi.logout()
  } catch {
    /* encerra localmente mesmo se a API falhar */
  }
  sessionStore.end('logout')
  void qc
}

/** Limpeza ao encerrar sessão: cache privado e carrinho do usuário anterior. */
export function clearPrivateCache(qc: QueryClient, prevUserId: string | null) {
  void qc.cancelQueries({ queryKey: ['private'] })
  qc.removeQueries({ queryKey: ['private'] })
  if (prevUserId) qc.removeQueries({ queryKey: qk.cart(prevUserId) })
}
