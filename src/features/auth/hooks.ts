import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/endpoints'
import type { LoginRequest, RegisterRequest } from '@/contracts'
import { PRIVATE_PREFIXES } from '@/lib/session-store'
import { completeSignIn, signOut } from './session'

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (session) => completeSignIn(qc, session),
  })
}

export function useRegister() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: (session) => completeSignIn(qc, session),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: () => signOut(qc) })
}

/**
 * Destino ao FECHAR o card de entrar/criar conta sem autenticar: voltar para
 * uma página privada reabriria o login (o card nunca fecharia). Nesse caso
 * vai para o carrinho (quem estava pagando) ou para o início.
 */
export function closeAuthTarget(target: unknown) {
  const dest = safeRedirect(target)
  if (!PRIVATE_PREFIXES.some((p) => dest.startsWith(p))) return dest
  return dest.startsWith('/pagamento') ? '/carrinho' : '/'
}

/** Aceita apenas caminhos internos como destino de retorno (evita open redirect). */
export function safeRedirect(target: unknown, fallback = '/') {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) return fallback
  if (target.startsWith('/login') || target.startsWith('/cadastro')) return fallback
  return target
}
