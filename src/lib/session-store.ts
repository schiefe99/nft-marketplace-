import { useSyncExternalStore } from 'react'
import type { Session, User } from '@/contracts'

/**
 * Estado local da sessão. O token é a única credencial persistida (nunca a senha).
 * A fonte da verdade continua sendo a API (`GET /api/auth/session`).
 */
const SESSION_KEY = 'nft-app-session'
const GUEST_KEY = 'nft-app-guest'

export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous'

interface State {
  status: SessionStatus
  token: string | null
  user: User | null
  /** Motivo do último encerramento (para mensagens na tela de login) */
  endedReason: 'expired' | 'logout' | null
}

function readToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as { token: string }).token : null
  } catch {
    return null
  }
}

let state: State = { status: readToken() ? 'unknown' : 'anonymous', token: readToken(), user: null, endedReason: null }
const listeners = new Set<() => void>()
const endListeners = new Set<(prevUserId: string | null, reason: 'expired' | 'logout') => void>()

function set(next: Partial<State>) {
  state = { ...state, ...next }
  listeners.forEach((l) => l())
}

export const sessionStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
  /** Notificado quando a sessão termina (logout/expiração) — usado para limpar cache e sockets. */
  onEnd(listener: (prevUserId: string | null, reason: 'expired' | 'logout') => void) {
    endListeners.add(listener)
    return () => {
      endListeners.delete(listener)
    }
  },
  signIn(session: Session) {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify({ token: session.token }))
    } catch {
      /* noop */
    }
    set({ status: 'authenticated', token: session.token, user: session.user, endedReason: null })
  },
  setUser(user: User) {
    set({ user })
  },
  end(reason: 'expired' | 'logout') {
    const prev = state.user?.id ?? null
    try {
      localStorage.removeItem(SESSION_KEY)
    } catch {
      /* noop */
    }
    set({ status: 'anonymous', token: null, user: null, endedReason: reason })
    endListeners.forEach((l) => l(prev, reason))
  },
  guestId() {
    try {
      let id = localStorage.getItem(GUEST_KEY)
      if (!id) {
        id = `guest-${crypto.randomUUID()}`
        localStorage.setItem(GUEST_KEY, id)
      }
      return id
    } catch {
      return 'guest-ephemeral-0000'
    }
  },
}

export function useSession() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get)
}

/** Rotas que exigem autenticação (usado ao tratar expiração durante a navegação). */
export const PRIVATE_PREFIXES = ['/pagamento', '/pedido', '/favoritos', '/conta']
