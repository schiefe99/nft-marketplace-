import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Heart, Search, ShoppingCart } from 'lucide-react'
import type { NftSummary } from '@/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { useFavorites, useToggleFavorite } from '@/features/catalog/hooks'
import { useSession } from '@/lib/session-store'

const RARITY_LABEL = { rare: 'RARO', legendary: 'LENDÁRIO', common: null } as const

export function NftCard({ nft, priority = false, compact = false }: { nft: NftSummary; priority?: boolean; compact?: boolean }) {
  const { user } = useSession()
  const favorites = useFavorites()
  const toggle = useToggleFavorite()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const isFav = Boolean(favorites.data?.nftIds.includes(nft.id))
  const soldOut = nft.totalAvailable === 0
  const rarity = RARITY_LABEL[nft.rarity]

  const onFavorite = () => {
    if (!user) {
      void navigate({ to: '/login', search: { redirect: href } })
      return
    }
    toggle.mutate({ nftId: nft.id, favorite: !isFav, name: nft.name })
  }

  return (
    <article className="group relative flex flex-col gap-3" data-testid="nft-card" aria-labelledby={`nft-${nft.id}-name`}>
      <div className="relative aspect-[258/300] rounded-sm bg-surface p-1">
        <div className="flex h-full items-center">
          <img
            src={nft.imageUrl}
            alt={`Ilustração do NFT ${nft.name}`}
            width={250}
            height={250}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
            className={cn('aspect-square w-full rounded-[18px] object-cover', soldOut && 'opacity-60 grayscale-[40%]')}
          />
        </div>
        {rarity && (
          <span className="absolute left-0 top-[3%] bg-primary px-3 py-0.5 text-sm font-bold text-primary-foreground">{rarity}</span>
        )}
        {soldOut && (
          <span className="absolute right-2 top-2 rounded-sm bg-background/90 px-2 py-0.5 text-xs font-bold text-warning">ESGOTADO</span>
        )}
        {!compact && (
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-3 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
            <Link
              to="/nft/$nftId"
              params={{ nftId: nft.id }}
              className="grid size-9 place-items-center rounded-sm bg-surface text-foreground hover:text-accent"
              aria-label={`Comprar ${nft.name}`}
            >
              <ShoppingCart className="size-5" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={onFavorite}
              aria-pressed={isFav}
              aria-label={isFav ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
              className="grid size-9 place-items-center rounded-sm bg-surface text-foreground hover:text-accent"
              data-testid="favorite-toggle"
            >
              <Heart className={cn('size-5', isFav && 'fill-primary text-primary')} aria-hidden="true" />
            </button>
            <Link
              to="/nft/$nftId"
              params={{ nftId: nft.id }}
              className="grid size-9 place-items-center rounded-sm bg-surface text-foreground hover:text-accent"
              aria-label={`Ver detalhes de ${nft.name}`}
              tabIndex={-1}
            >
              <Search className="size-5" aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 id={`nft-${nft.id}-name`} className="text-base leading-5">
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:content-[''] hover:text-accent">
            {nft.name}
          </Link>
        </h3>
        <p className="text-base font-bold text-accent" data-testid="nft-price">
          {formatEth(nft.priceEth)}
          {soldOut && <span className="sr-only"> — esgotado</span>}
        </p>
      </div>
    </article>
  )
}

export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <Skeleton className="aspect-[258/300] w-full rounded-sm" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-5 w-1/3" />
    </div>
  )
}
