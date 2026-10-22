import { Link, useNavigate, useParams, useRouter, useRouterState } from '@tanstack/react-router'
import { ArrowLeft, Heart, Mail, ShoppingCart, Star, ZoomIn } from 'lucide-react'
import { Linkedin, Twitter } from '@/components/brand-icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { isApiError } from '@/api/client'
import { Breadcrumb, container } from '@/components/layout'
import { NftCard, NftCardSkeleton } from '@/components/nft-card'
import { QuantityStepper } from '@/components/quantity'
import { ErrorState } from '@/components/states'
import { Button, buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { Edition, Nft } from '@/contracts'
import { NETWORKS } from '@/contracts'
import { useAddToCart, useCart } from '@/features/cart/hooks'
import { useFavorites, useNft, useNftList, useToggleFavorite } from '@/features/catalog/hooks'
import { formatEth } from '@/lib/money'
import { useSession } from '@/lib/session-store'
import { cn, shortAddress } from '@/lib/utils'

const EDITION_STATUS: Record<Edition['status'], string> = { available: '', sold_out: 'esgotada', unavailable: 'indisponível' }

function Stars({ value }: { value: number }) {
  return (
    <span className="flex gap-1" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn('size-[15px]', i < Math.round(value) ? 'fill-primary text-primary' : 'fill-caption/40 text-caption/40')} />
      ))}
    </span>
  )
}

/** Mesmo grid/dimensões do conteúdo final para evitar deslocamento de layout (CLS). */
function DetailSkeleton() {
  return (
    <div className="pb-28 md:pb-0" data-testid="detail-skeleton">
      <div className="mt-4 h-9 md:hidden" />
      <Skeleton className="mt-8 hidden h-5 w-64 md:block" />
      <div className="mt-4 grid gap-8 md:mt-5 lg:grid-cols-[100px_444px_1fr]">
        <div className="order-2 flex gap-3 lg:order-1 lg:flex-col lg:gap-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="size-16 rounded-sm md:size-[100px]" />)}
        </div>
        <div className="order-1 rounded-sm bg-surface p-5 lg:order-2">
          <Skeleton className="aspect-square w-full rounded-[18px]" />
        </div>
        <div className="order-3 flex flex-col gap-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-16 w-1/2" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-2/3" />
        </div>
      </div>
      <div className="mt-16 min-h-[420px]" />
    </div>
  )
}

function NotFoundNft() {
  return (
    <section className="mx-auto mt-16 flex max-w-lg flex-col items-center gap-4 text-center" aria-labelledby="nft-nf" data-testid="nft-not-found">
      <h1 id="nft-nf" className="text-2xl font-bold">NFT não encontrado</h1>
      <p className="text-muted">Este NFT não existe ou foi removido do mercado.</p>
      <Link to="/mercado" className={buttonVariants({ size: 'md' })}>Explorar o mercado</Link>
    </section>
  )
}

function useAnnouncePriceChange(nft?: Nft) {
  const prev = useRef<string | null>(null)
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (!nft) return
    if (prev.current && prev.current !== `${nft.priceEth}|${nft.totalAvailable}`) {
      setMessage(`Atualização em tempo real: preço ${formatEth(nft.priceEth)}, ${nft.totalAvailable} unidade(s) disponível(is).`)
    }
    prev.current = `${nft.priceEth}|${nft.totalAvailable}`
  }, [nft])
  return message
}

export function NftDetailPage() {
  const { nftId } = useParams({ from: '/nft/$nftId' })
  const query = useNft(nftId)
  const nft = query.data

  if (query.isPending) return <div className={container}><DetailSkeleton /></div>
  if (query.isError) {
    if (isApiError(query.error) && query.error.status === 404) return <div className={container}><NotFoundNft /></div>
    return <div className={cn(container, 'mt-10')}><ErrorState error={query.error} onRetry={() => query.refetch()} title="Não foi possível carregar o NFT" /></div>
  }
  return <NftDetail nft={nft!} />
}

function NftDetail({ nft }: { nft: Nft }) {
  const router = useRouter()
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const { user } = useSession()
  const cart = useCart()
  const add = useAddToCart()
  const favorites = useFavorites()
  const toggleFav = useToggleFavorite()
  const announce = useAnnouncePriceChange(nft)

  const firstAvailable = nft.editions.find((e) => e.name === '1/50' && e.status === 'available') ?? nft.editions.find((e) => e.status === 'available') ?? nft.editions[0]
  const [editionId, setEditionId] = useState(firstAvailable.id)
  const edition = nft.editions.find((e) => e.id === editionId) ?? firstAvailable
  const inCart = cart.data?.items.find((i) => i.editionId === edition.id)?.quantity ?? 0
  const maxQty = Math.max(0, Math.min(edition.available, edition.maxPerOrder) - inCart)
  const [qty, setQty] = useState(1)
  const [image, setImage] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [tab, setTab] = useState<'details' | 'reviews'>('details')
  const isFav = Boolean(favorites.data?.nftIds.includes(nft.id))
  const purchasable = edition.status === 'available' && maxQty > 0

  useEffect(() => {
    setQty((q) => Math.max(1, Math.min(q, maxQty || 1)))
  }, [maxQty])

  const buy = async (goToCart: boolean) => {
    try {
      await add.mutateAsync({ nftId: nft.id, editionId: edition.id, quantity: qty, name: `${nft.name} (${edition.name})` })
      setQty(1)
      if (goToCart) void navigate({ to: '/carrinho' })
    } catch (err) {
      toast.error(isApiError(err) ? err.message : 'Não foi possível adicionar ao carrinho.')
    }
  }

  const onFavorite = () => {
    if (!user) return void navigate({ to: '/login', search: { redirect: href } })
    toggleFav.mutate({ nftId: nft.id, favorite: !isFav, name: nft.name })
  }

  const network = NETWORKS.find((n) => n.value === nft.chain)?.label ?? nft.chain
  const limitMessage =
    edition.status !== 'available'
      ? `Edição ${edition.name} ${EDITION_STATUS[edition.status]}.`
      : maxQty === 0
        ? inCart > 0
          ? `Você já tem o máximo permitido desta edição no carrinho (${inCart}).`
          : 'Sem unidades disponíveis.'
        : `Máximo de ${maxQty} unidade(s) nesta edição${inCart ? ` (você já tem ${inCart} no carrinho)` : ''}.`

  return (
    <div className={cn(container, 'pb-28 md:pb-0')}>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {/* topo mobile */}
      <div className="mt-4 flex items-center justify-between md:hidden">
        <button type="button" onClick={() => router.history.back()} className="grid size-9 place-items-center rounded-full bg-surface" aria-label="Voltar">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <button type="button" onClick={onFavorite} aria-pressed={isFav} className="grid size-9 place-items-center rounded-full bg-surface" aria-label={isFav ? 'Remover dos favoritos' : 'Favoritar'}>
          <Heart className={cn('size-5 text-accent', isFav && 'fill-primary')} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-8 hidden md:block">
        <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: nft.name }]} />
      </div>

      <div className="mt-4 grid gap-8 md:mt-5 lg:grid-cols-[100px_444px_1fr]">
        <ul className="order-2 flex gap-3 lg:order-1 lg:flex-col lg:gap-4" aria-label="Galeria">
          {nft.gallery.map((src, i) => (
            <li key={`${src}-${i}`}>
              <button type="button" onClick={() => setImage(i)} aria-label={`Ver imagem ${i + 1} de ${nft.gallery.length}`} aria-current={i === image} className={cn('block overflow-hidden rounded-sm border-2 border-transparent', i === image && 'border-primary')}>
                <img src={src.replace(/\.webp$/, '-thumb.webp')} alt="" width={100} height={100} className="size-16 object-cover md:size-[100px]" />
              </button>
            </li>
          ))}
        </ul>
        <div className="order-1 lg:order-2">
          <div className="relative rounded-sm bg-surface p-5">
            <img src={nft.gallery[image] ?? nft.imageUrl} alt={`Ilustração do NFT ${nft.name}, imagem ${image + 1}`} width={404} height={404} fetchPriority="high" className="aspect-square w-full rounded-[18px] object-cover" />
            <button type="button" onClick={() => setZoom(true)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full bg-background/80" aria-label="Ampliar imagem">
              <ZoomIn className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <section className="order-3 flex flex-col gap-4" aria-labelledby="nft-title">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h1 id="nft-title" className="text-xl font-bold md:text-[28px] md:leading-9">{nft.name}</h1>
            <span className="rounded-full border border-primary px-2 py-0.5 text-xs md:hidden">
              <Star className="mr-1 inline size-3 fill-primary text-primary" aria-hidden="true" />
              {nft.rating.average} ({nft.rating.count})
            </span>
          </div>
          <div className="hidden items-center justify-between border-b border-border pb-3 md:flex">
            <p className="text-2xl font-bold text-accent" data-testid="detail-price">{formatEth(edition.priceEth)}</p>
            <p className="flex items-center gap-2 text-[15px]">
              <Stars value={nft.rating.average} />
              <span>{nft.rating.count} avaliações de colecionadores</span>
              <span className="sr-only">, nota média {nft.rating.average} de 5</span>
            </p>
          </div>
          <div>
            <h2 className="text-[15px] font-bold">Sobre este NFT:</h2>
            <p className="mt-2 text-sm leading-6 text-accent">{nft.description}</p>
          </div>

          <fieldset>
            <legend className="text-[15px] font-bold">Edição:</legend>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Edição">
              {nft.editions.map((e) => {
                const selected = e.id === edition.id
                const disabled = e.status !== 'available'
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={disabled}
                    onClick={() => setEditionId(e.id)}
                    className={cn(
                      'rounded-full border border-border-soft px-2 py-1 text-sm uppercase',
                      selected && 'border-primary font-bold text-accent',
                      disabled && 'text-caption line-through decoration-1',
                    )}
                  >
                    {e.name}
                    {disabled && <span className="sr-only"> ({EDITION_STATUS[e.status]})</span>}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-muted" id="edition-hint" data-testid="edition-hint">
              {formatEth(edition.priceEth)} · {edition.available} disponível(is) · {limitMessage}
            </p>
          </fieldset>

          <div className="hidden flex-wrap items-center justify-between gap-4 md:flex">
            <QuantityStepper value={qty} max={Math.max(1, maxQty)} onChange={setQty} label="Quantidade" disabled={!purchasable} size="lg" />
            <div className="flex gap-3">
              <Button size="md" onClick={() => buy(true)} disabled={!purchasable || add.isPending} aria-describedby="edition-hint" className="w-[130px]">
                {add.isPending ? 'ADICIONANDO…' : 'COMPRAR'}
              </Button>
              <Button variant="outline" size="md" onClick={onFavorite} aria-pressed={isFav} disabled={toggleFav.isPending} data-testid="detail-favorite">
                <Heart className={cn(isFav && 'fill-primary')} aria-hidden="true" /> {isFav ? 'Favoritado' : 'Favoritar'}
              </Button>
            </div>
          </div>

          <dl className="flex flex-col gap-3 text-[15px] text-accent">
            <div><dt className="inline">ID do token: </dt><dd className="inline">{nft.tokenId}</dd></div>
            <div><dt className="inline">Coleção: </dt><dd className="inline">{nft.collection}</dd></div>
            <div><dt className="inline">Atributos: </dt><dd className="inline">{nft.attributes.join(', ')}</dd></div>
          </dl>
          <div className="hidden items-center gap-3 md:flex">
            <span className="text-[15px] font-bold">Compartilhar este NFT:</span>
            <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no LinkedIn (abre em nova aba)"><Linkedin className="size-5" aria-hidden="true" /></a>
            <a href={`mailto:?subject=${encodeURIComponent(nft.name)}&body=${encodeURIComponent(window.location.href)}`} aria-label="Compartilhar por e-mail"><Mail className="size-5" aria-hidden="true" /></a>
            <a href={`https://x.com/intent/post?url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener noreferrer" aria-label="Compartilhar no X (abre em nova aba)"><Twitter className="size-5" aria-hidden="true" /></a>
          </div>
        </section>
      </div>

      {/* Barra de compra mobile (frame "Mobile / Detalhes do NFT") */}
      <div className="fixed inset-x-0 bottom-[57px] z-30 border-t border-border bg-surface px-4 py-3 md:hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">Qtd.</span>
            <QuantityStepper value={qty} max={Math.max(1, maxQty)} onChange={setQty} label="Quantidade" disabled={!purchasable} />
          </div>
          <p className="text-lg font-bold text-accent">{formatEth(edition.priceEth)}</p>
        </div>
        <div className="mt-3 flex gap-3">
          <Button className="flex-1 rounded-full" size="md" onClick={() => buy(true)} disabled={!purchasable || add.isPending}>Comprar NFT</Button>
          <Button variant="secondary" size="icon" className="rounded-full" onClick={() => buy(false)} disabled={!purchasable || add.isPending} aria-label="Adicionar ao carrinho">
            <ShoppingCart className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <section className="mt-16" aria-label="Informações adicionais">
        <div role="tablist" aria-label="Informações do NFT" className="flex gap-8 border-b border-border">
          {([
            ['details', 'Detalhes do NFT'],
            ['reviews', `Avaliações de colecionadores (${nft.rating.count})`],
          ] as const).map(([v, l]) => (
            <button key={v} role="tab" id={`tab-${v}`} aria-controls={`panel-${v}`} aria-selected={tab === v} type="button" onClick={() => setTab(v)} className={cn('-mb-px border-b-[3px] border-transparent pb-2 text-base md:text-lg', tab === v && 'border-primary font-bold text-accent')}>
              {l}
            </button>
          ))}
        </div>
        {tab === 'details' ? (
          <div role="tabpanel" id="panel-details" aria-labelledby="tab-details" className="mt-4 space-y-4 text-sm leading-6 text-accent">
            <p>{nft.description} A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede.</p>
            <div><h3 className="font-bold text-foreground">Rede:</h3><p>Cunhado na {network} com procedência imutável e metadados armazenados no IPFS.</p></div>
            <div><h3 className="font-bold text-foreground">Contrato:</h3><p>Direitos autorais do criador: {nft.royaltyPercent}% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.</p></div>
            <div><h3 className="font-bold text-foreground">Direitos autorais:</h3><p>{shortAddress(nft.contractAddress)} • Contrato inteligente ERC-721 verificado.</p></div>
          </div>
        ) : (
          <div role="tabpanel" id="panel-reviews" aria-labelledby="tab-reviews" className="mt-4 text-sm text-muted">
            <p>Nota média {nft.rating.average} de 5, com base em {nft.rating.count} avaliações. A listagem de avaliações individuais não faz parte desta entrega.</p>
          </div>
        )}
      </section>

      <MoreFromCollection nft={nft} />

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>{nft.name}</DialogTitle>
          <img src={nft.gallery[image] ?? nft.imageUrl} alt={`Ilustração ampliada do NFT ${nft.name}`} width={480} height={480} className="mt-4 aspect-square w-full rounded-md object-cover" />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function MoreFromCollection({ nft }: { nft: Nft }) {
  const list = useNftList(useMemo(() => ({ pageSize: 6, sort: 'recent' as const, page: 1 }), []))
  const items = (list.data?.items ?? []).filter((n) => n.id !== nft.id).slice(0, 5)
  return (
    <section className="mt-20" aria-labelledby="more-title">
      <h2 id="more-title" className="border-b border-border pb-3 text-base font-bold text-accent">Mais desta coleção</h2>
      <ul className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
        {list.isPending
          ? Array.from({ length: 5 }, (_, i) => <li key={i}><NftCardSkeleton /></li>)
          : items.map((n) => <li key={n.id}><NftCard nft={n} compact /></li>)}
      </ul>
    </section>
  )
}
