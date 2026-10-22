import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { catalogApi } from '@/api/endpoints'
import { Breadcrumb, container } from '@/components/layout'
import { NftCard, NftCardSkeleton } from '@/components/nft-card'
import { EmptyState, ErrorState } from '@/components/states'
import { buttonVariants } from '@/components/ui/button'
import { useFavorites } from '@/features/catalog/hooks'
import { useSession } from '@/lib/session-store'

export function FavoritesPage() {
  const { user } = useSession()
  const favorites = useFavorites()
  const ids = favorites.data?.nftIds ?? []
  const list = useQuery({
    queryKey: ['private', user?.id ?? 'anon', 'favorites', 'items', ids],
    queryFn: ({ signal }) => catalogApi.list({ ids, pageSize: 48 }, signal),
    enabled: favorites.isSuccess && ids.length > 0,
    placeholderData: (prev) => prev,
  })
  return (
    <div className={container}>
      <div className="mt-8"><Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Lista de interesse' }]} /></div>
      <h1 className="mt-6 text-2xl font-bold">Lista de interesse</h1>
      <div className="mt-8">
        {favorites.isPending || (ids.length > 0 && list.isPending) ? (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <NftCardSkeleton key={i} />)}</div>
        ) : favorites.isError ? (
          <ErrorState error={favorites.error} onRetry={() => favorites.refetch()} />
        ) : ids.length === 0 ? (
          <EmptyState title="Você ainda não favoritou nenhum NFT" action={<Link to="/mercado" className={buttonVariants({ size: 'md' })}>Explorar o mercado</Link>} />
        ) : (
          <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {list.data?.items.filter((n) => ids.includes(n.id)).map((n) => <li key={n.id}><NftCard nft={n} /></li>)}
          </ul>
        )}
      </div>
    </div>
  )
}
