import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cartApi } from '@/api/endpoints'
import { isApiError } from '@/api/client'
import { qk } from '@/api/query'
import type { AddCartItemRequest, Cart } from '@/contracts'
import { sessionStore, useSession } from '@/lib/session-store'

export function useCartOwner() {
  const { user, status } = useSession()
  return { owner: user?.id ?? sessionStore.guestId(), ready: status !== 'unknown' }
}

/** Carrinho vive na API (visitante via X-Guest-Id, usuário via token) → sobrevive a refresh. */
export function useCart() {
  const { owner, ready } = useCartOwner()
  return useQuery({ queryKey: qk.cart(owner), queryFn: ({ signal }) => cartApi.get(signal), enabled: ready, staleTime: 10_000 })
}

function useCartMutation<TVars>(fn: (vars: TVars) => Promise<Cart>, opts: { success?: (vars: TVars) => string | null } = {}) {
  const qc = useQueryClient()
  const { owner } = useCartOwner()
  return useMutation({
    mutationFn: fn,
    onSuccess: (cart, vars) => {
      qc.setQueryData(qk.cart(owner), cart)
      const msg = opts.success?.(vars)
      if (msg) toast.success(msg)
    },
    onError: (err) => {
      // conflito de disponibilidade → recarrega o carrinho para refletir o estado real
      if (isApiError(err) && (err.code === 'AVAILABILITY_CONFLICT' || err.code === 'NOT_FOUND')) void qc.invalidateQueries({ queryKey: qk.cart(owner) })
    },
  })
}

export const useAddToCart = () =>
  useCartMutation((vars: AddCartItemRequest & { name: string }) => cartApi.add(vars), {
    success: (v) => `${v.quantity}× "${v.name}" adicionado ao carrinho.`,
  })

export const useUpdateCartItem = () => useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) => cartApi.update(itemId, quantity))

export const useRemoveCartItem = () =>
  useCartMutation(({ itemId }: { itemId: string; name: string }) => cartApi.remove(itemId), { success: (v) => `"${v.name}" removido do carrinho.` })

export const useApplyCoupon = () => useCartMutation((code: string) => cartApi.applyCoupon(code), { success: (c) => `Cupom ${c.toUpperCase()} aplicado.` })

export const useRemoveCoupon = () => useCartMutation(() => cartApi.removeCoupon(), { success: () => 'Cupom removido.' })

export const useAcknowledgeCart = () => useCartMutation(() => cartApi.acknowledge())

export const cartCount = (cart?: Cart) => cart?.items.reduce((n, i) => n + i.quantity, 0) ?? 0
