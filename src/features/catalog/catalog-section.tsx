import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { NftCard, NftCardSkeleton } from '@/components/nft-card'
import { EmptyState, ErrorState } from '@/components/states'
import type { CatalogMeta, CatalogTab, Category, NftFacets, NftSort } from '@/contracts'
import { CATEGORIES } from '@/contracts'
import Decimal from 'decimal.js'
import { formatEth, toEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/lib/use-media'
import { useCatalogMeta, useNftList } from './hooks'
import { hasActiveFilters, SORT_OPTIONS, toListParams, type CatalogSearch } from './search'

type SearchUpdate = Partial<CatalogSearch>

/** Atualiza a URL; qualquer mudança de filtro reinicia a paginação. */
function useCatalogNavigation() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as CatalogSearch
  const update = (patch: SearchUpdate, opts: { keepPage?: boolean; replace?: boolean } = {}) =>
    navigate({
      to: '.',
      search: (prev: CatalogSearch) => {
        const next: CatalogSearch = { ...prev, ...patch }
        if (!opts.keepPage) delete next.page
        for (const k of Object.keys(next) as (keyof CatalogSearch)[]) {
          const v = next[k]
          if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) delete next[k]
        }
        return next
      },
      replace: opts.replace,
      resetScroll: false,
    })
  return { search, update }
}

const TABS: { value: CatalogTab; label: string }[] = [
  { value: 'all', label: 'Todos os NFTs' },
  { value: 'new', label: 'Novos lançamentos' },
  { value: 'trending', label: 'Em alta' },
]

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="text-base font-bold">{title}</h3>
      {children}
    </section>
  )
}

// slider trabalha em centésimos de ETH (inteiros) para evitar erro de ponto flutuante
const toCents = (v: string, round: (n: number) => number) => round(new Decimal(v).times(100).toNumber())
const fromCents = (c: number) => toEth(new Decimal(c).div(100))

/** Faixa de preço com dois controles (frame "Início": trilho + "Preço: x - y ETH" + Aplicar). */
function PriceRange({ range, idPrefix }: { range: CatalogMeta['priceRange']; idPrefix: string }) {
  const { search, update } = useCatalogNavigation()
  const lo = toCents(range.min, Math.floor)
  const hi = toCents(range.max, Math.ceil)
  const clamp = (c: number) => Math.min(hi, Math.max(lo, c))
  const fromSearch = (): [number, number] => [
    search.minPrice ? clamp(toCents(search.minPrice, Math.floor)) : lo,
    search.maxPrice ? clamp(toCents(search.maxPrice, Math.ceil)) : hi,
  ]
  const [[min, max], setValue] = useState(fromSearch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setValue(fromSearch()), [search.minPrice, search.maxPrice, lo, hi])

  const pct = (c: number) => (hi > lo ? ((c - lo) / (hi - lo)) * 100 : 0)
  const commit = () => {
    const next = { minPrice: min > lo ? fromCents(min) : undefined, maxPrice: max < hi ? fromCents(max) : undefined }
    if (next.minPrice !== search.minPrice || next.maxPrice !== search.maxPrice) void update(next)
  }
  const apply = (e: FormEvent) => {
    e.preventDefault()
    commit()
  }
  // soltar o controle (mouse, toque ou setas do teclado) já carrega a faixa escolhida; "Aplicar" continua disponível
  const release = { onPointerUp: commit, onKeyUp: commit }
  const thumb =
    'pointer-events-none absolute inset-0 h-4 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-surface-2 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-surface-2'

  return (
    <form onSubmit={apply} className="flex flex-col gap-3">
      <div className="relative mx-1 h-4">
        <div aria-hidden="true" className="absolute inset-x-0 top-[7px] h-0.5 bg-border-soft" />
        <div aria-hidden="true" className="absolute top-[7px] h-0.5 bg-primary" style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }} />
        <label htmlFor={`${idPrefix}-min`} className="sr-only">Preço mínimo (ETH)</label>
        <input
          id={`${idPrefix}-min`}
          type="range"
          min={lo}
          max={hi}
          value={min}
          onChange={(e) => setValue([Math.min(Number(e.target.value), max), max])}
          {...release}
          aria-valuetext={formatEth(fromCents(min))}
          className={thumb}
        />
        <label htmlFor={`${idPrefix}-max`} className="sr-only">Preço máximo (ETH)</label>
        <input
          id={`${idPrefix}-max`}
          type="range"
          min={lo}
          max={hi}
          value={max}
          onChange={(e) => setValue([min, Math.max(Number(e.target.value), min)])}
          {...release}
          aria-valuetext={formatEth(fromCents(max))}
          className={thumb}
        />
      </div>
      <p className="mx-3 text-sm" aria-live="polite">
        {/* rótulo do Figma usa duas casas e vírgula: "Preço: 0,02 - 12,30 ETH" */}
        Preço: {new Decimal(min).div(100).toFixed(2).replace('.', ',')} - {new Decimal(max).div(100).toFixed(2).replace('.', ',')} ETH
      </p>
      <Button type="submit" size="sm" className="ml-3 w-fit">Aplicar</Button>
    </form>
  )
}

function Filters({ meta, facets, idPrefix }: { meta?: CatalogMeta; facets?: NftFacets; idPrefix: string }) {
  const { search, update } = useCatalogNavigation()

  const selected = new Set(search.category ?? [])
  const toggleCategory = (c: Category) => {
    const next = new Set(selected)
    if (next.has(c)) next.delete(c)
    else next.add(c)
    void update({ category: [...next].sort() })
  }

  return (
    <div className="flex flex-col gap-8">
      <FilterGroup title="Coleções">
        <ul className="flex flex-col gap-1">
          {[...(meta?.categories ?? CATEGORIES.map((c) => ({ ...c, count: undefined })))].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')).map((c) => {
            const active = selected.has(c.value)
            const count = facets?.categories[c.value] ?? c.count
            return (
              <li key={c.value}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleCategory(c.value)}
                  className={cn('flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-[15px] text-muted hover:bg-white/5 hover:text-foreground', active && 'bg-primary/10 font-bold text-accent')}
                >
                  <span>{c.label}</span>
                  <span className="tabular-nums">{count !== undefined ? `(${count})` : ''}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </FilterGroup>
      <FilterGroup title="Faixa de preço">
        {meta ? <PriceRange range={meta.priceRange} idPrefix={idPrefix} /> : <Skeleton className="mx-3 h-24" />}
      </FilterGroup>
      <FilterGroup title="Rede">
        <ul className="flex flex-col gap-1">
          {(meta?.networks ?? []).map((n) => {
            const active = search.network === n.value
            return (
              <li key={n.value}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => update({ network: active ? undefined : n.value })}
                  className={cn('flex w-full items-center justify-between rounded-sm px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-foreground', active && 'bg-primary/10 font-bold text-accent')}
                >
                  <span>{n.label}</span>
                  <span className="tabular-nums">({facets?.networks[n.value] ?? n.count})</span>
                </button>
              </li>
            )
          })}
        </ul>
      </FilterGroup>
      <FilterGroup title="Disponibilidade">
        <div className="flex flex-wrap gap-2 px-3">
          {([
            ['all', 'Todos'],
            ['available', 'Disponíveis'],
            ['sold_out', 'Esgotados'],
          ] as const).map(([v, l]) => {
            const active = (search.availability ?? 'all') === v
            return (
              <button key={v} type="button" aria-pressed={active} onClick={() => update({ availability: v === 'all' ? undefined : v })} className={cn('rounded-full border border-border-soft px-3 py-1 text-xs', active && 'border-primary bg-primary/15 text-accent')}>
                {l}
              </button>
            )
          })}
        </div>
      </FilterGroup>
    </div>
  )
}

/** Contagem regressiva até a meia-noite local: a oferta "vira" todo dia. */
function useOfferCountdown() {
  const remaining = () => {
    const end = new Date()
    end.setHours(24, 0, 0, 0)
    return Math.max(0, Math.floor((end.getTime() - Date.now()) / 1000))
  }
  const [secs, setSecs] = useState(remaining)
  useEffect(() => {
    const t = setInterval(() => setSecs(remaining()), 1000)
    return () => clearInterval(t)
  }, [])
  return [Math.floor(secs / 3600), Math.floor((secs % 3600) / 60), secs % 60].map((n) => String(n).padStart(2, '0'))
}

function FeaturedBanner({ meta }: { meta?: CatalogMeta }) {
  const nft = meta?.featured[0]
  const [h, m, s] = useOfferCountdown()
  return (
    // borda em gradiente + brilho pulsante: destaca a oferta sem competir com o catálogo
    <section aria-labelledby="featured-title" className="offer-glow relative rounded-md bg-gradient-to-br from-primary via-border-soft to-primary p-px">
      <div className="relative overflow-hidden rounded-[9px] bg-gradient-to-b from-surface-2 to-surface px-4 pb-4 pt-5">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/25 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <h2 id="featured-title" className="text-2xl font-bold leading-7 text-accent">NFT EM<br />DESTAQUE</h2>
          <span className="flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] text-primary-foreground shadow-[0_4px_14px_rgba(232,155,85,0.45)]">
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary-foreground/70" />
              <span className="relative inline-flex size-2 rounded-full bg-primary-foreground" />
            </span>
            AO VIVO
          </span>
        </div>
        <p className="relative mt-3 text-center text-lg font-bold tracking-[0.12em] text-foreground [text-shadow:0_0_18px_rgba(232,155,85,0.6)]">OFERTA LIMITADA</p>
        <p className="relative mt-2 flex items-center justify-center gap-1.5 text-sm" role="timer" aria-label={`Termina em ${h} horas, ${m} minutos e ${s} segundos`}>
          <span className="text-muted">Termina em</span>
          {[h, m, s].map((v, i) => (
            <span key={i} className="flex items-center gap-1.5" aria-hidden="true">
              {i > 0 && <span className="text-accent">:</span>}
              <span className="min-w-8 rounded-sm bg-background/70 px-1.5 py-0.5 text-center font-bold tabular-nums text-accent shadow-inner">{v}</span>
            </span>
          ))}
        </p>
        {nft ? (
          <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="group/offer relative mt-4 block overflow-hidden rounded-[14px] shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)]" aria-label={`Ver ${nft.name} em destaque`}>
            <img src={nft.imageUrl} alt={`NFT em destaque: ${nft.name}`} width={310} height={365} loading="lazy" className="aspect-[310/365] w-full object-cover transition-transform duration-500 group-hover/offer:scale-105" />
            <span aria-hidden="true" className="offer-shine pointer-events-none absolute inset-0" />
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-3 pt-10">
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{nft.name}</span>
                <span className="block text-xs text-muted">{nft.totalAvailable > 0 ? `Restam ${nft.totalAvailable} edições` : 'Esgotado'}</span>
              </span>
              <span className="shrink-0 rounded-sm bg-primary px-2 py-1 text-sm font-bold text-primary-foreground">{formatEth(nft.priceEth)}</span>
            </span>
          </Link>
        ) : (
          <Skeleton className="mt-4 aspect-[310/365] w-full rounded-[14px]" />
        )}
      </div>
    </section>
  )
}

function SearchField({ placeholder = 'Buscar NFTs, coleções ou criadores', className }: { placeholder?: string; className?: string }) {
  const { search, update } = useCatalogNavigation()
  const [value, setValue] = useState(search.q ?? '')
  useEffect(() => setValue(search.q ?? ''), [search.q])
  // debounce: atualiza a URL 350 ms após parar de digitar (substitui a entrada do histórico)
  useEffect(() => {
    if ((search.q ?? '') === value.trim()) return
    const t = setTimeout(() => update({ q: value.trim() || undefined }, { replace: true }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div role="search" className={cn('relative w-full md:max-w-sm', className)}>
      <label htmlFor="catalog-search" className="sr-only">Buscar no catálogo</label>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
      <Input id="catalog-search" type="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} className="h-10 pl-9 pr-9" />
      {value && (
        <button type="button" onClick={() => setValue('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted hover:text-foreground" aria-label="Limpar busca">
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  const { update } = useCatalogNavigation()
  if (totalPages <= 1) return null
  const go = (p: number) => {
    void update({ page: p > 1 ? p : undefined }, { keepPage: true })
    document.getElementById('catalogo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
  const cls = 'grid size-[35px] place-items-center rounded-sm border border-border-soft text-sm disabled:opacity-40'
  return (
    <nav aria-label="Paginação" className="mt-10 flex justify-end">
      <ul className="flex flex-wrap items-center gap-2">
        <li>
          <button type="button" className={cls} onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Página anterior">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        </li>
        {pages.map((p) => (
          <li key={p}>
            <button type="button" className={cn(cls, p === page && 'border-primary bg-primary font-bold text-primary-foreground')} aria-current={p === page ? 'page' : undefined} aria-label={`Página ${p}`} onClick={() => go(p)}>
              {p}
            </button>
          </li>
        ))}
        <li>
          <button type="button" className={cls} onClick={() => go(page + 1)} disabled={page >= totalPages} aria-label="Próxima página">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </li>
      </ul>
    </nav>
  )
}

/** Disparado pelo botão de filtros do topo mobile; a seção do catálogo abre o painel. */
const OPEN_FILTERS_EVENT = 'kurio:open-filters'

/** Topo mobile (frame "Mobile / Início"): busca + botão laranja de filtros. */
export function CatalogMobileBar() {
  return (
    <div className="flex gap-2 px-4 pt-5">
      <SearchField placeholder="Explorar coleções" className="flex-1" />
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_FILTERS_EVENT))}
        aria-label="Abrir filtros"
        className="grid h-10 w-11 shrink-0 place-items-center rounded-sm bg-primary text-primary-foreground transition-colors hover:bg-primary-hover active:scale-95"
      >
        <SlidersHorizontal className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}

function SortSelect() {
  const { search, update } = useCatalogNavigation()
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="whitespace-nowrap text-[15px]">Ordenar por:</label>
      <select
        id="sort"
        value={search.sort ?? 'recent'}
        onChange={(e) => update({ sort: e.target.value === 'recent' ? undefined : (e.target.value as NftSort) })}
        className="rounded-sm bg-transparent py-1 pr-1 text-[15px] text-foreground"
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value} className="bg-surface">{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export function CatalogSection({ heading }: { heading?: string }) {
  const { search, update } = useCatalogNavigation()
  const meta = useCatalogMeta()
  const params = toListParams(search)
  const list = useNftList(params)
  const isMobile = useIsMobile()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const tab = search.tab ?? 'all'
  const showSkeleton = list.isPending
  const isRefreshing = list.isFetching && !list.isPending

  useEffect(() => {
    const open = () => setFiltersOpen(true)
    window.addEventListener(OPEN_FILTERS_EVENT, open)
    return () => window.removeEventListener(OPEN_FILTERS_EVENT, open)
  }, [])

  // mobile: segunda coluna desce meia altura (cards intercalados do frame "Mobile / Início")
  const gridCls = 'grid grid-cols-2 gap-x-3 gap-y-6 max-sm:[&>*:nth-child(even)]:translate-y-6 max-sm:pb-6 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-10 md:gap-x-[34px] md:gap-y-12'

  return (
    <section id="catalogo" aria-labelledby="catalog-heading" className="scroll-mt-4">
      <h2 id="catalog-heading" className={heading ? 'mb-6 text-2xl font-bold' : 'sr-only'}>{heading ?? 'Catálogo de NFTs'}</h2>
      <div className="grid gap-12 lg:grid-cols-[310px_1fr]">
        <aside className="hidden flex-col gap-6 lg:flex" aria-label="Filtros">
          <div className="rounded-sm bg-surface px-5 py-6">
            <Filters meta={meta.data} facets={list.data?.facets} idPrefix="desk" />
          </div>
          <FeaturedBanner meta={meta.data} />
        </aside>

        <div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div role="tablist" aria-label="Seções do catálogo" className="flex gap-3 overflow-x-auto md:gap-4">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.value}
                  onClick={() => update({ tab: t.value === 'all' ? undefined : t.value })}
                  className={cn('whitespace-nowrap border-b border-transparent pb-0.5 text-xs transition-colors hover:text-accent md:border-b-2 md:pb-1 md:text-[15px] md:font-bold', tab === t.value && 'border-accent text-accent md:border-primary')}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {!isMobile && <SortSelect />}
          </div>

          {/* no celular a busca e os filtros ficam no topo da tela (CatalogMobileBar) */}
          {!isMobile && (
            <div className="mt-5 flex items-center gap-2">
              <SearchField />
              <Button variant="secondary" size="icon" className="shrink-0 lg:hidden" onClick={() => setFiltersOpen(true)} aria-label="Abrir filtros">
                <SlidersHorizontal className="size-5" aria-hidden="true" />
              </Button>
            </div>
          )}

          <div className="mt-3 flex min-h-6 flex-wrap items-center gap-3 text-xs text-muted md:text-sm" aria-live="polite" data-testid="results-status">
            {list.data && !showSkeleton && (
              <span>
                {list.data.total} {list.data.total === 1 ? 'resultado' : 'resultados'}
                {isRefreshing && ' · atualizando…'}
              </span>
            )}
            {hasActiveFilters(search) && (
              <button type="button" className="text-accent underline-offset-4 hover:underline" onClick={() => navigateClear(update)}>
                Limpar filtros
              </button>
            )}
          </div>

          <div className="mt-4" aria-busy={list.isFetching}>
            {showSkeleton ? (
              <div className={gridCls} data-testid="catalog-skeleton">
                {Array.from({ length: 6 }, (_, i) => <NftCardSkeleton key={i} />)}
              </div>
            ) : list.isError && !list.data ? (
              <ErrorState error={list.error} onRetry={() => list.refetch()} title="Não foi possível carregar o catálogo" />
            ) : list.data && list.data.items.length === 0 ? (
              <EmptyState title="Nenhum NFT encontrado" description="Ajuste a busca ou os filtros para ver mais resultados." action={<Button size="md" variant="outline" onClick={() => navigateClear(update)}>Limpar filtros</Button>} />
            ) : (
              <ul className={cn(gridCls, isRefreshing && 'opacity-70 transition-opacity')} data-testid="catalog-grid">
                {list.data?.items.map((nft, i) => (
                  <li key={nft.id}>
                    <NftCard nft={nft} priority={i < 3} />
                  </li>
                ))}
              </ul>
            )}
            {list.isError && list.data && (
              <p role="alert" className="mt-4 text-sm text-danger">Falha ao atualizar. Exibindo os últimos resultados. <button className="underline" onClick={() => list.refetch()}>Tentar novamente</button></p>
            )}
          </div>
          {list.data && <Pagination page={list.data.page} totalPages={list.data.totalPages} />}
        </div>
      </div>

      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent side="right">
          <DialogTitle className="text-xl">Filtros</DialogTitle>
          <DialogDescription>Os filtros são aplicados imediatamente.</DialogDescription>
          {isMobile && <div className="mt-6"><SortSelect /></div>}
          <div className="mt-6">
            <Filters meta={meta.data} facets={list.data?.facets} idPrefix="mob" />
          </div>
          <Button size="md" className="mt-8" onClick={() => setFiltersOpen(false)}>
            Ver resultados{list.data ? ` (${list.data.total})` : ''}
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  )
}

function navigateClear(update: (p: SearchUpdate) => unknown) {
  void update({ tab: undefined, network: undefined, q: undefined, category: undefined, collection: undefined, minPrice: undefined, maxPrice: undefined, availability: undefined, sort: undefined })
}
