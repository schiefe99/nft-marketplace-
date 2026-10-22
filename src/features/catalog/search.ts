import type { AvailabilityFilter, CatalogTab, Category, Network, NftListParams, NftSort } from '@/contracts'
import { CATEGORIES, NETWORKS } from '@/contracts'
import { isValidEth } from '@/lib/money'

/** Estado do catálogo na URL — sobrevive a refresh e navegação pelo histórico. */
export interface CatalogSearch {
  tab?: CatalogTab
  network?: Network
  q?: string
  category?: Category[]
  collection?: string
  minPrice?: string
  maxPrice?: string
  availability?: AvailabilityFilter
  sort?: NftSort
  page?: number
}

const SORTS: NftSort[] = ['recent', 'price-asc', 'price-desc', 'name']
const AVAIL: AvailabilityFilter[] = ['all', 'available', 'sold_out']
const CAT_VALUES = new Set(CATEGORIES.map((c) => c.value))

export const PAGE_SIZE = 9

export function validateCatalogSearch(raw: Record<string, unknown>): CatalogSearch {
  const out: CatalogSearch = {}
  if (raw.tab === 'new' || raw.tab === 'trending') out.tab = raw.tab
  if (NETWORKS.some((n) => n.value === raw.network)) out.network = raw.network as Network
  if (typeof raw.q === 'string' && raw.q.trim()) out.q = raw.q.slice(0, 80)
  const cats = Array.isArray(raw.category) ? raw.category : typeof raw.category === 'string' ? [raw.category] : []
  const validCats = cats.filter((c): c is Category => typeof c === 'string' && CAT_VALUES.has(c as Category))
  if (validCats.length) out.category = [...new Set(validCats)].sort()
  if (typeof raw.collection === 'string' && raw.collection) out.collection = raw.collection
  const min = raw.minPrice != null ? String(raw.minPrice) : ''
  const max = raw.maxPrice != null ? String(raw.maxPrice) : ''
  if (min && isValidEth(min)) out.minPrice = min
  if (max && isValidEth(max)) out.maxPrice = max
  if (AVAIL.includes(raw.availability as AvailabilityFilter) && raw.availability !== 'all') out.availability = raw.availability as AvailabilityFilter
  if (SORTS.includes(raw.sort as NftSort) && raw.sort !== 'recent') out.sort = raw.sort as NftSort
  const page = Number(raw.page)
  if (Number.isInteger(page) && page > 1) out.page = page
  return out
}

export function toListParams(s: CatalogSearch): NftListParams {
  return {
    tab: s.tab ?? 'all',
    network: s.network,
    q: s.q,
    category: s.category,
    collection: s.collection,
    minPrice: s.minPrice,
    maxPrice: s.maxPrice,
    availability: s.availability ?? 'all',
    sort: s.sort ?? 'recent',
    page: s.page ?? 1,
    pageSize: PAGE_SIZE,
  }
}

export const SORT_OPTIONS: { value: NftSort; label: string }[] = [
  { value: 'recent', label: 'Listados recentemente' },
  { value: 'price-asc', label: 'Menor preço' },
  { value: 'price-desc', label: 'Maior preço' },
  { value: 'name', label: 'Nome (A–Z)' },
]

export const hasActiveFilters = (s: CatalogSearch) =>
  Boolean(s.tab || s.network || s.q || s.category?.length || s.collection || s.minPrice || s.maxPrice || s.availability)
