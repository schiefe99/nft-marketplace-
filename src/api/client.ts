import axios, { AxiosError } from 'axios'
import type { ApiErrorBody, ApiErrorCode } from '@/contracts'
import { sessionStore } from '@/lib/session-store'

/** Erro normalizado — toda falha de transporte/HTTP vira ApiError tipado. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode | 'NETWORK_ERROR' | 'TIMEOUT' | 'CANCELED',
    message: string,
    public fields: Record<string, string> = {},
    public details?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
  /** Falhas transitórias podem ser repetidas com segurança (GETs ou com idempotência). */
  get isTransient() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT' || this.status >= 500
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 10_000),
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const { token } = sessionStore.get()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set('X-Guest-Id', sessionStore.guestId())
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiErrorBody>) => {
    if (axios.isCancel(error)) return Promise.reject(new ApiError(0, 'CANCELED', 'Requisição cancelada.'))
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return Promise.reject(new ApiError(0, 'TIMEOUT', 'A requisição demorou demais. Tente novamente.'))
    }
    if (!error.response) {
      return Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'Falha de conexão. Verifique sua internet e tente novamente.'))
    }
    const { status, data } = error.response
    const body = data?.error
    const apiError = new ApiError(status, body?.code ?? 'INTERNAL_ERROR', body?.message ?? 'Erro inesperado.', body?.fields ?? {}, body?.details)
    // Sessão expirada/ inválida durante a navegação → encerra a sessão local
    if (status === 401 && (apiError.code === 'SESSION_EXPIRED' || apiError.code === 'UNAUTHENTICATED') && sessionStore.get().token) {
      sessionStore.end('expired')
    }
    return Promise.reject(apiError)
  },
)
