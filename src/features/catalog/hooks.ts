import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { catalogApi, favoritesApi } from '@/api/endpoints'
import { qk } from '@/api/query'
import type { FavoritesResponse, NftListParams } from '@/contracts'
import { useSession } from '@/lib/session-store'

export function useCatalogMeta() {
  return useQuery({ queryKey: qk.catalogMeta, queryFn: ({ signal }) => catalogApi.meta(signal), staleTime: 5 * 60_000 })
}

/**
 * Lista do catálogo. A chave inclui todos os parâmetros; o AbortSignal do
 * TanStack Query cancela a requisição anterior quando os filtros mudam, e
 * respostas fora de ordem nunca sobrescrevem a chave atual.
 */
export function useNftList(params: NftListParams) {
  return useQuery({
    queryKey: qk.nftList(params),
    queryFn: ({ signal }) => catalogApi.list(params, signal),
    placeholderData: keepPreviousData,
  })
}

export function useNft(id: string) {
  return useQuery({ queryKey: qk.nft(id), queryFn: ({ signal }) => catalogApi.detail(id, signal) })
}

export function useFavorites() {
  const { user } = useSession()
  return useQuery({
    queryKey: qk.favorites(user?.id ?? 'anon'),
    queryFn: ({ signal }) => favoritesApi.list(signal),
    enabled: Boolean(user),
  })
}

/** Favoritar com atualização otimista e rollback em caso de falha. */
export function useToggleFavorite() {
  const qc = useQueryClient()
  const { user } = useSession()
  return useMutation({
    mutationKey: ['favorite-toggle'],
    mutationFn: ({ nftId, favorite }: { nftId: string; favorite: boolean; name: string }) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ nftId, favorite }) => {
      if (!user) return { previous: undefined }
      const key = qk.favorites(user.id)
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<FavoritesResponse>(key)
      qc.setQueryData<FavoritesResponse>(key, (old) => {
        const ids = new Set(old?.nftIds ?? [])
        if (favorite) ids.add(nftId)
        else ids.delete(nftId)
        return { nftIds: [...ids] }
      })
      return { previous, key }
    },
    onError: (_err, { name, favorite }, ctx) => {
      if (ctx?.key) qc.setQueryData(ctx.key, ctx.previous)
      toast.error(favorite ? `Não foi possível favoritar "${name}".` : `Não foi possível remover "${name}" dos favoritos.`, {
        description: 'O estado anterior foi restaurado. Tente novamente.',
      })
    },
    onSuccess: (data, { name, favorite }) => {
      if (user) qc.setQueryData(qk.favorites(user.id), data)
      toast.success(favorite ? `"${name}" adicionado aos favoritos.` : `"${name}" removido dos favoritos.`)
    },
    onSettled: () => {
      if (user) void qc.invalidateQueries({ queryKey: qk.favorites(user.id) })
    },
  })
}
