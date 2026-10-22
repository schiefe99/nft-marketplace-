import { http, HttpResponse } from 'msw'
import type { CatalogMeta, Category, FavoritesResponse, Nft, NftSort, NftSummary, Paginated } from '@/contracts'
import { CATEGORIES, NETWORKS } from '@/contracts'
import { compareEth, isValidEth } from '@/lib/money'
import { db, findNft, persist } from '../db'
import { fail, requireUser, route } from '../http-utils'
import { has } from '../scenarios'

export const toSummary = (n: Nft): NftSummary => ({
  id: n.id,
  tokenId: n.tokenId,
  name: n.name,
  rarity: n.rarity,
  rating: n.rating,
  isNew: n.isNew,
  isTrending: n.isTrending,
  imageUrl: n.imageUrl,
  collection: n.collection,
  category: n.category,
  creator: n.creator,
  priceEth: n.priceEth,
  highestBidEth: n.highestBidEth,
  totalAvailable: n.totalAvailable,
  createdAt: n.createdAt,
  version: n.version,
})

const SORTS: NftSort[] = ['recent', 'price-asc', 'price-desc', 'name']

export const catalogHandlers = [
  http.get('/api/catalog/meta', route(() => {
    const nfts = db().nfts
    const meta: CatalogMeta = {
      collections: [...new Set(nfts.map((n) => n.collection))].sort(),
      categories: CATEGORIES.map((c) => ({ ...c, count: nfts.filter((n) => n.category === c.value).length })),
      networks: NETWORKS.map((n) => ({ value: n.value, label: n.label, count: nfts.filter((x) => x.chain === n.value).length })),
      priceRange: {
        min: nfts.reduce((m, n) => (compareEth(n.priceEth, m) < 0 ? n.priceEth : m), nfts[0]?.priceEth ?? '0'),
        max: nfts.reduce((m, n) => (compareEth(n.priceEth, m) > 0 ? n.priceEth : m), '0'),
      },
      featured: has('empty-catalog') ? [] : [nfts[1], nfts[0], nfts[2]].map(toSummary),
      stats: { totalSales: '240k+', auctions: '100k+', artists: '240k+' },
    }
    return HttpResponse.json(meta)
  })),

  http.get('/api/nfts', route(({ request }) => {
    if (has('server-error')) throw fail(500, 'TRANSIENT_FAILURE', 'Falha temporária ao carregar o catálogo.')
    const url = new URL(request.url)
    const p = url.searchParams
    const tab = p.get('tab') ?? 'all'
    const q = (p.get('q') ?? '').trim().toLowerCase()
    const categories = p.getAll('category') as Category[]
    const collection = p.get('collection')
    const network = p.get('network')
    const minPrice = p.get('minPrice')
    const maxPrice = p.get('maxPrice')
    const availability = p.get('availability') ?? 'all'
    const sort = (p.get('sort') ?? 'recent') as NftSort
    const page = Number(p.get('page') ?? '1')
    const pageSize = Number(p.get('pageSize') ?? '12')

    const fields: Record<string, string> = {}
    if (!Number.isInteger(page) || page < 1) fields.page = 'Página inválida.'
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 48) fields.pageSize = 'Tamanho de página inválido.'
    if (minPrice && !isValidEth(minPrice)) fields.minPrice = 'Preço mínimo inválido.'
    if (maxPrice && !isValidEth(maxPrice)) fields.maxPrice = 'Preço máximo inválido.'
    if (!['all', 'new', 'trending'].includes(tab)) fields.tab = 'Aba inválida.'
    if (!SORTS.includes(sort)) fields.sort = 'Ordenação inválida.'
    if (Object.keys(fields).length) throw fail(422, 'VALIDATION_ERROR', 'Parâmetros inválidos.', { fields })

    let list = has('empty-catalog') ? [] : [...db().nfts]
    const ids = p.getAll('ids')
    if (ids.length) list = list.filter((n) => ids.includes(n.id))
    if (tab === 'new') list = list.filter((n) => n.isNew)
    if (tab === 'trending') list = list.filter((n) => n.isTrending)
    if (q) list = list.filter((n) => `${n.name} ${n.collection} ${n.creator.name}`.toLowerCase().includes(q))
    if (categories.length) list = list.filter((n) => categories.includes(n.category))
    if (collection) list = list.filter((n) => n.collection === collection)
    if (network) list = list.filter((n) => n.chain === network)
    if (minPrice) list = list.filter((n) => compareEth(n.priceEth, minPrice) >= 0)
    if (maxPrice) list = list.filter((n) => compareEth(n.priceEth, maxPrice) <= 0)
    if (availability === 'available') list = list.filter((n) => n.totalAvailable > 0)
    if (availability === 'sold_out') list = list.filter((n) => n.totalAvailable === 0)
    list.sort((a, b) => {
      switch (sort) {
        case 'price-asc': return compareEth(a.priceEth, b.priceEth) || a.id.localeCompare(b.id)
        case 'price-desc': return compareEth(b.priceEth, a.priceEth) || a.id.localeCompare(b.id)
        case 'name': return a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id)
        default: return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
      }
    })
    const total = list.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const items = list.slice((page - 1) * pageSize, page * pageSize).map(toSummary)
    return HttpResponse.json<Paginated<NftSummary>>({ items, page, pageSize, total, totalPages })
  }, { kind: 'list' })),

  http.get('/api/nfts/:id', route(({ params }) => {
    if (has('server-error')) throw fail(500, 'TRANSIENT_FAILURE', 'Falha temporária ao carregar o NFT.')
    const nft = findNft(String(params.id))
    if (!nft) throw fail(404, 'NOT_FOUND', 'NFT não encontrado.')
    return HttpResponse.json<Nft>(nft)
  })),

  // ---------- Favoritos ----------
  http.get('/api/me/favorites', route(({ request }) => {
    const { user } = requireUser(request)
    return HttpResponse.json<FavoritesResponse>({ nftIds: db().favorites[user.id] ?? [] })
  })),

  http.put('/api/me/favorites/:nftId', route(({ request, params }) => {
    const { user } = requireUser(request)
    if (has('favorite-failure')) throw fail(500, 'TRANSIENT_FAILURE', 'Não foi possível salvar o favorito.')
    const id = String(params.nftId)
    if (!findNft(id)) throw fail(404, 'NOT_FOUND', 'NFT não encontrado.')
    const list = (db().favorites[user.id] ??= [])
    if (!list.includes(id)) list.push(id)
    persist()
    return HttpResponse.json<FavoritesResponse>({ nftIds: list })
  })),

  http.delete('/api/me/favorites/:nftId', route(({ request, params }) => {
    const { user } = requireUser(request)
    if (has('favorite-failure')) throw fail(500, 'TRANSIENT_FAILURE', 'Não foi possível remover o favorito.')
    const id = String(params.nftId)
    db().favorites[user.id] = (db().favorites[user.id] ?? []).filter((x) => x !== id)
    persist()
    return HttpResponse.json<FavoritesResponse>({ nftIds: db().favorites[user.id] })
  })),
]
