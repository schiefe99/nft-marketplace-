import { QueryClient } from '@tanstack/react-query'
import type { NftListParams } from '@/contracts'
import { isApiError } from './client'

/**
 * Chaves de cache. Dados privados incluem o "dono" (userId ou guestId) para
 * garantir isolamento entre usuários; listagens incluem todos os parâmetros.
 */
export const qk = {
  session: ['session'] as const,
  catalogMeta: ['catalog', 'meta'] as const,
  nftLists: ['nfts', 'list'] as const,
  nftList: (params: NftListParams) => ['nfts', 'list', params] as const,
  nft: (id: string) => ['nfts', 'detail', id] as const,
  favorites: (userId: string) => ['private', userId, 'favorites'] as const,
  cart: (owner: string) => ['cart', owner] as const,
  orders: (userId: string) => ['private', userId, 'orders'] as const,
  order: (userId: string, id: string) => ['private', userId, 'orders', id] as const,
  profile: (userId: string) => ['private', userId, 'profile'] as const,
  wallets: (userId: string) => ['private', userId, 'wallets'] as const,
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        // Repete apenas falhas transitórias (rede/5xx), até 2x com backoff exponencial
        retry: (count, error) => isApiError(error) && error.isTransient && count < 2,
        retryDelay: (attempt) => Math.min(500 * 2 ** attempt, 4000),
      },
      mutations: {
        // Mutations não são repetidas automaticamente (exceto pedidos, que usam idempotência)
        retry: false,
      },
    },
  })
}
