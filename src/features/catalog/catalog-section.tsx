import { useNavigate, useSearch } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { NftCard, NftCardSkeleton } from '@/components/nft-card'
import { EmptyState, ErrorState } from '@/components/states'
import type { CatalogMeta, CatalogTab, Category, NftSort } from '@/contracts'
import { CATEGORIES } from '@/contracts'
import { formatEth, isValidEth } from '@/lib/money'
import { cn } from '@/lib/utils'
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

function Filters({ meta, idPrefix }: { meta?: CatalogMeta; idPrefix: string }) {
  const { search, update } = useCatalogNavigation()
  const [min, setMin] = useState(search.minPrice ?? '')
  const [max, setMax] = useState(search.maxPrice ?? '')
  const [priceError, setPriceError] = useState<string | null>(null)
  useEffect(() => {
    setMin(search.minPrice ?? '')
    setMax(search.maxPrice ?? '')
  }, [search.minPrice, search.maxPrice])

  const selected = new Set(search.category ?? [])
  const toggleCategory = (c: Category) => {
    const next = new Set(selected)
    if (next.has(c)) next.delete(c)
    else next.add(c)
    void update({ category: [...next].sort() })
  }

  const applyPrice = (e: FormEvent) => {
    e.preventDefault()
    const mn = min.replace(',', '.').trim()
    const mx = max.replace(',', '.').trim()
    if ((mn && !isValidEth(mn)) || (mx && !isValidEth(mx))) return setPriceError('Use valores numéricos, ex.: 0.5')
    if (mn && mx && Number(mn) > Number(mx)) return setPriceError('O mínimo deve ser menor que o máximo.')
    setPriceError(null)
    void update({ minPrice: mn || undefined, maxPrice: mx || undefined })
  }

  const errId = `${idPrefix}-price-error`
  return (
    <div className="flex flex-col gap-8">
      <FilterGroup title="Coleções">
        <ul className="flex flex-col gap-1">
          {(meta?.categories ?? CATEGORIES.map((c) => ({ ...c, count: undefined }))).map((c) => {
            const active = selected.has(c.value)
            return (
              <li key={c.value}>
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleCategory(c.value)}
                  className={cn('flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-[15px] text-muted hover:bg-white/5 hover:text-foreground', active && 'bg-primary/10 font-bold text-accent')}
                >
                  <span>{c.label}</span>
                  <span className="tabular-nums">{c.count !== undefined ? `(${c.count})` : ''}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </FilterGroup>
      <FilterGroup title="Faixa de preço">
        <form onSubmit={applyPrice} className="flex flex-col gap-3 px-3" noValidate>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${idPrefix}-min`} className="text-xs text-muted">Mínimo (ETH)</label>
              <Input id={`${idPrefix}-min`} inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder={meta?.priceRange.min ?? '0'} aria-invalid={Boolean(priceError)} aria-describedby={priceError ? errId : undefined} className="h-9" />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-max`} className="text-xs text-muted">Máximo (ETH)</label>
              <Input id={`${idPrefix}-max`} inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} placeholder={meta?.priceRange.max ?? ''} aria-invalid={Boolean(priceError)} aria-describedby={priceError ? errId : undefined} className="h-9" />
            </div>
          </div>
          {meta && <p className="text-sm">Preço: {formatEth(meta.priceRange.min, { symbol: false })} - {formatEth(meta.priceRange.max)}</p>}
          {priceError && <p id={errId} role="alert" className="text-sm text-danger">{priceError}</p>}
          <Button type="submit" size="sm" className="w-fit">Aplicar</Button>
        </form>
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
                  <span>({n.count})</span>
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

function FeaturedBanner({ meta }: { meta?: CatalogMeta }) {
  const nft = meta?.featured[0]
  return (
    <section aria-labelledby="featured-title" className="relative overflow-hidden rounded-sm bg-gradient-to-b from-[#2a1a12] to-background">
      <div className="px-5 pt-6 text-center">
        <h2 id="featured-title" className="text-left text-2xl font-bold text-accent">NFT EM DESTAQUE</h2>
        <p className="mt-2 text-lg font-bold tracking-[0.04em]">OFERTA LIMITADA</p>
      </div>
      {nft ? (
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="mt-3 block" aria-label={`Ver ${nft.name} em destaque`}>
          <img src={nft.imageUrl} alt={`NFT em destaque: ${nft.name}`} width={310} height={365} loading="lazy" className="aspect-[310/365] w-full rounded-[18px] object-cover" />
        </Link>
      ) : (
        <Skeleton className="mt-3 aspect-[310/365] w-full rounded-[18px]" />
      )}
    </section>
  )
}

function SearchField() {
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
    <div role="search" className="relative w-full md:max-w-sm">
      <label htmlFor="catalog-search" className="sr-only">Buscar no catálogo</label>
      <Input id="catalog-search" type="search" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Buscar NFTs, coleções ou criadores" className="h-10 pr-9" />
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

export function CatalogSection({ heading }: { heading?: string }) {
  const { search, update } = useCatalogNavigation()
  const meta = useCatalogMeta()
  const params = toListParams(search)
  const list = useNftList(params)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const tab = search.tab ?? 'all'
  const showSkeleton = list.isPending
  const isRefreshing = list.isFetching && !list.isPending

  return (
    <section id="catalogo" aria-labelledby="catalog-heading" className="scroll-mt-4">
      <h2 id="catalog-heading" className={heading ? 'mb-6 text-2xl font-bold' : 'sr-only'}>{heading ?? 'Catálogo de NFTs'}</h2>
      <div className="grid gap-12 lg:grid-cols-[310px_1fr]">
        <aside className="hidden flex-col gap-6 lg:flex" aria-label="Filtros">
          <div className="rounded-sm bg-surface px-5 py-6">
            <Filters meta={meta.data} idPrefix="desk" />
          </div>
          <FeaturedBanner meta={meta.data} />
        </aside>

        <div>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div role="tablist" aria-label="Seções do catálogo" className="flex gap-4 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.value}
                  onClick={() => update({ tab: t.value === 'all' ? undefined : t.value })}
                  className={cn('whitespace-nowrap border-b-2 border-transparent pb-1 text-[15px] font-bold', tab === t.value && 'border-primary text-accent')}
                >
                  {t.label}
                </button>
              ))}
            </div>
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
          </div>

          <div className="mt-5 flex items-center gap-2">
            <SearchField />
            <Button variant="secondary" size="icon" className="shrink-0 lg:hidden" onClick={() => setFiltersOpen(true)} aria-label="Abrir filtros">
              <SlidersHorizontal className="size-5" aria-hidden="true" />
            </Button>
          </div>

          <div className="mt-3 flex min-h-6 flex-wrap items-center gap-3 text-sm text-muted" aria-live="polite" data-testid="results-status">
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
              <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:gap-x-8" data-testid="catalog-skeleton">
                {Array.from({ length: 6 }, (_, i) => <NftCardSkeleton key={i} />)}
              </div>
            ) : list.isError && !list.data ? (
              <ErrorState error={list.error} onRetry={() => list.refetch()} title="Não foi possível carregar o catálogo" />
            ) : list.data && list.data.items.length === 0 ? (
              <EmptyState title="Nenhum NFT encontrado" description="Ajuste a busca ou os filtros para ver mais resultados." action={<Button size="md" variant="outline" onClick={() => navigateClear(update)}>Limpar filtros</Button>} />
            ) : (
              <ul className={cn('grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 md:gap-x-8', isRefreshing && 'opacity-70 transition-opacity')} data-testid="catalog-grid">
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
          <div className="mt-6">
            <Filters meta={meta.data} idPrefix="mob" />
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
