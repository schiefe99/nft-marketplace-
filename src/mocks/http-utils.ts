import { delay, HttpResponse } from 'msw'
import type { ApiErrorBody, ApiErrorCode } from '@/contracts'
import { db, sessionFromToken } from './db'
import { has, nextLatency, takeInjectedFailure } from './scenarios'

export function apiError(status: number, code: ApiErrorCode, message: string, extra: Partial<ApiErrorBody['error']> = {}) {
  return HttpResponse.json<ApiErrorBody>({ error: { code, message, ...extra } }, { status })
}

/** Erro de resposta → Response; usado com `throw` dentro dos resolvers. */
export class HttpError extends Error {
  constructor(public response: Response) {
    super('http error')
  }
}

export const fail = (status: number, code: ApiErrorCode, message: string, extra: Partial<ApiErrorBody['error']> = {}) =>
  new HttpError(apiError(status, code, message, extra))

const bearer = (request: Request) => request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null

/** Exige sessão válida; diferencia sessão expirada de ausente. */
export function requireUser(request: Request) {
  const token = bearer(request)
  const { session, expired } = sessionFromToken(token)
  if (!session) {
    if (expired) throw fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
    throw fail(401, 'UNAUTHENTICATED', 'É necessário entrar para continuar.')
  }
  const user = db().users.find((u) => u.id === session.userId)
  if (!user) throw fail(401, 'UNAUTHENTICATED', 'Usuário não encontrado.')
  return { user, session }
}

export function optionalUser(request: Request) {
  const token = bearer(request)
  const { session, expired } = sessionFromToken(token)
  if (!session && expired) throw fail(401, 'SESSION_EXPIRED', 'Sua sessão expirou. Entre novamente.')
  return session ? db().users.find((u) => u.id === session.userId) ?? null : null
}

/** Chave do carrinho: usuário autenticado ou visitante (cabeçalho X-Guest-Id). */
export function cartKey(request: Request) {
  const user = optionalUser(request)
  if (user) return { key: `user:${user.id}`, user }
  const guest = request.headers.get('x-guest-id')
  if (!guest || !/^[\w-]{8,64}$/.test(guest)) throw fail(400, 'VALIDATION_ERROR', 'Identificador de visitante ausente.')
  return { key: `guest:${guest}`, user: null }
}

type Resolver = (args: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => Promise<Response> | Response

/**
 * Envolve um resolver com: latência do cenário, modo offline, falhas injetadas
 * e conversão de HttpError em resposta.
 */
export function route(resolver: Resolver, opts: { kind?: 'list' | 'other' } = {}) {
  return async (info: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => {
    const { request } = info
    const url = new URL(request.url)
    await delay(nextLatency(opts.kind))
    if (has('offline')) return HttpResponse.error()
    const injected = takeInjectedFailure(request.method, url.pathname)
    if (injected) {
      if (injected.status === 'network') return HttpResponse.error()
      return apiError(injected.status, injected.status >= 500 ? 'TRANSIENT_FAILURE' : 'VALIDATION_ERROR', 'Falha simulada.')
    }
    try {
      return await resolver(info)
    } catch (err) {
      if (err instanceof HttpError) return err.response
      console.error('[mocks] erro inesperado', err)
      return apiError(500, 'INTERNAL_ERROR', 'Erro interno simulado.')
    }
  }
}

export async function readJson<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T
  } catch {
    throw fail(400, 'VALIDATION_ERROR', 'Corpo da requisição inválido.')
  }
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
export const SOL_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

export function validatePassword(pw: string | undefined) {
  if (!pw || pw.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'A senha deve conter letras e números.'
  return null
}
