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
    <article className="group relative flex flex-col gap-1.5 md:gap-3" data-testid="nft-card" aria-labelledby={`nft-${nft.id}-name`}>
      {/* fundo acompanha a imagem quadrada: mesmo padding nos quatro lados, em todas as telas */}
      <div className="relative rounded-lg bg-surface p-2">
        <img
          src={nft.imageUrl}
          alt={`Ilustração do NFT ${nft.name}`}
          width={250}
          height={250}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          className={cn('block aspect-square w-full rounded-md object-cover transition-transform duration-300 md:group-hover:scale-[1.02]', soldOut && 'opacity-60 grayscale-[40%]')}
        />
        {rarity && (
          <span className="absolute left-0 top-4 bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground md:px-3 md:text-sm">{rarity}</span>
        )}
        {soldOut && (
          <span className="absolute right-2 top-2 rounded-sm bg-background/90 px-2 py-0.5 text-xs font-bold text-warning">ESGOTADO</span>
        )}
        {!compact && (
          <div className="absolute inset-x-0 bottom-3 z-10 hidden justify-center gap-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 md:flex">
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
      <div className="flex flex-col gap-1 px-2 md:gap-1.5 md:px-0">
        <h3 id={`nft-${nft.id}-name`} className="text-xs leading-4 md:text-base md:leading-5">
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="after:absolute after:inset-0 after:content-[''] hover:text-accent">
            {nft.name}
          </Link>
        </h3>
        <p className="text-xs font-bold text-accent md:text-base" data-testid="nft-price">
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
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-5 w-1/3" />
    </div>
  )
}
