import { useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '@/api/endpoints'
import type { LoginRequest, RegisterRequest } from '@/contracts'
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

/** Aceita apenas caminhos internos como destino de retorno (evita open redirect). */
export function safeRedirect(target: unknown, fallback = '/') {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) return fallback
  if (target.startsWith('/login') || target.startsWith('/cadastro')) return fallback
  return target
}
