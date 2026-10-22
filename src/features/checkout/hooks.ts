import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { accountApi, checkoutApi } from '@/api/endpoints'
import { ApiError, isApiError } from '@/api/client'
import { qk } from '@/api/query'
import type { CreateOrderRequest, Network, Order, Quote } from '@/contracts'
import { useSession } from '@/lib/session-store'

const KEY_STORAGE = 'nft-app-idempotency'

/**
 * Chave de idempotência estável por "tentativa de compra": derivada do
 * fingerprint da cotação + carteira + rede. Reenvios (duplo clique, timeout,
 * refresh) reutilizam a mesma chave; uma cotação nova gera outra chave.
 */
export function idempotencyKeyFor(body: CreateOrderRequest) {
  const attempt = `${body.quoteId}|${body.quoteFingerprint}|${body.walletId}|${body.network}|${JSON.stringify(body.buyer)}`
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY_STORAGE) ?? 'null') as { attempt: string; key: string } | null
    if (stored?.attempt === attempt) return stored.key
    const key = `idem-${crypto.randomUUID()}`
    sessionStorage.setItem(KEY_STORAGE, JSON.stringify({ attempt, key }))
    return key
  } catch {
    return `idem-${attempt}`
  }
}

export function clearIdempotencyKey() {
  try {
    sessionStorage.removeItem(KEY_STORAGE)
  } catch {
    /* noop */
  }
}

export function useWallets() {
  const { user } = useSession()
  return useQuery({ queryKey: qk.wallets(user?.id ?? 'anon'), queryFn: ({ signal }) => accountApi.wallets(signal), enabled: Boolean(user) })
}

export function useQuote() {
  return useMutation({ mutationKey: ['quote'], mutationFn: (network: Network) => checkoutApi.quote(network) })
}

export function useConnectWallet() {
  return useMutation({ mutationFn: ({ walletId, network }: { walletId: string; network: Network }) => accountApi.connectWallet(walletId, network) })
}

export function usePendingOrders() {
  const { user } = useSession()
  return useQuery({
    queryKey: [...qk.orders(user?.id ?? 'anon'), 'pending'],
    queryFn: ({ signal }) => checkoutApi.orders('pending', signal),
    enabled: Boolean(user),
  })
}

/**
 * Criação idempotente do pedido. Falhas transitórias (rede/timeout/5xx) são
 * repetidas com a MESMA chave — a simulação devolve o mesmo pedido.
 */
export function useCreateOrder() {
  const qc = useQueryClient()
  const { user } = useSession()
  const inFlight = useRef(false)
  const mutation = useMutation({
    mutationKey: ['create-order'],
    mutationFn: async (body: CreateOrderRequest): Promise<Order> => {
      const key = idempotencyKeyFor(body)
      let lastError: unknown
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await checkoutApi.createOrder(body, key)
        } catch (err) {
          lastError = err
          if (!(isApiError(err) && err.isTransient)) throw err
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
        }
      }
      throw lastError
    },
    onSuccess: (order) => {
      if (user) qc.setQueryData(qk.order(user.id, order.id), order)
    },
  })
  /** Ignora cliques repetidos enquanto uma tentativa está em andamento. */
  const submit = async (body: CreateOrderRequest) => {
    if (inFlight.current) return null
    inFlight.current = true
    try {
      return await mutation.mutateAsync(body)
    } finally {
      inFlight.current = false
    }
  }
  return { ...mutation, submit }
}

export function staleQuoteFrom(err: unknown): Quote | null {
  if (err instanceof ApiError && (err.code === 'QUOTE_STALE' || err.code === 'AVAILABILITY_CONFLICT')) {
    const details = err.details as { quote?: Quote } | undefined
    return details?.quote ?? null
  }
  return null
}

export function useOrder(orderId: string) {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.order(user?.id ?? 'anon', orderId),
    queryFn: ({ signal }) => checkoutApi.order(orderId, signal),
    enabled: Boolean(user),
    // Socket é o canal principal; polling leve como rede de segurança enquanto pendente
    refetchInterval: (q) => (q.state.data?.status === 'pending' ? 4000 : false),
  })
}
