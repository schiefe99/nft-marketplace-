import type {
  AppliedCoupon,
  Cart,
  CartIssue,
  CartItem,
  CartSummary,
  Network,
  Nft,
  Order,
  Quote,
  QuoteLine,
  User,
  Wallet,
} from '@/contracts'
import { NETWORKS } from '@/contracts'
import { addEth, compareEth, eth, toEth } from '@/lib/money'
import { buildNfts, COUPONS, FIXTURE_USERS } from './fixtures'

/**
 * "Banco" do servidor simulado. Vive na memória da aba e é persistido no
 * localStorage para sobreviver a refresh. `resetDb()` restaura o cenário conhecido.
 */

export interface DbUser extends User {
  passwordHash: string
  salt: string
}

export interface DbSession {
  token: string
  userId: string
  expiresAt: number
}

export interface DbCartItem {
  id: string
  nftId: string
  editionId: string
  quantity: number
  /** Último preço que o cliente "viu" (para sinalizar alterações) */
  seenPriceEth: string
}

export interface DbCart {
  id: string
  items: DbCartItem[]
  couponCode: string | null
  version: number
  updatedAt: string
}

export interface DbOrder extends Order {
  /** Interno: quando a simulação deve liquidar o pedido */
  settleAt: number | null
  plannedOutcome: 'confirmed' | 'declined' | 'hold'
}

export interface DbIdempotency {
  userId: string
  requestHash: string
  orderId: string
  /** Simulação de timeout: a primeira resposta já foi "perdida" */
  responseDropped: boolean
}

export interface DbState {
  schema: number
  nfts: Nft[]
  users: DbUser[]
  sessions: DbSession[]
  favorites: Record<string, string[]>
  carts: Record<string, DbCart>
  wallets: Record<string, Wallet[]>
  quotes: Record<string, Quote & { userId: string }>
  orders: DbOrder[]
  idempotency: Record<string, DbIdempotency>
  seq: number
}

const STORAGE_KEY = 'nft-mock-db'
const SCHEMA = 5

let state: DbState

export const db = () => state

// ---------- Hash de senha (SHA-256 + salt). Nunca guardamos senha em claro. ----------
export async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export function nextId(prefix: string) {
  state.seq += 1
  return `${prefix}-${state.seq.toString(36).padStart(4, '0')}`
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Recalcula campos derivados do NFT (menor preço, total disponível). */
export function recomputeNft(nft: Nft) {
  for (const e of nft.editions) {
    if (e.status !== 'unavailable') e.status = e.available > 0 ? 'available' : 'sold_out'
  }
  const avail = nft.editions.filter((e) => e.status === 'available')
  // Preço de vitrine = edição 1/50 (como no Figma); se esgotada, a menor disponível
  const showcase = avail.find((e) => e.name === '1/50') ?? avail.reduce<typeof avail[number] | undefined>((min, e) => (!min || compareEth(e.priceEth, min.priceEth) < 0 ? e : min), undefined) ?? nft.editions.find((e) => e.name === '1/50') ?? nft.editions[0]
  nft.priceEth = showcase.priceEth
  nft.highestBidEth = toEth(eth(nft.priceEth).times('0.92'))
  nft.totalAvailable = avail.reduce((n, e) => n + e.available, 0)
}

async function seedState(): Promise<DbState> {
  const nfts = buildNfts()
  nfts.forEach(recomputeNft)
  const users: DbUser[] = []
  for (const u of FIXTURE_USERS) {
    const salt = `salt-${u.id}`
    users.push({
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      bio: u.bio,
      ensName: u.id === 'usr-ana' ? 'ana.kurio.eth' : null,
      avatarUrl: null,
      createdAt: '2026-01-15T10:00:00.000Z',
      salt,
      passwordHash: await hashPassword(u.password, salt),
    })
  }
  const now = '2026-01-15T10:00:00.000Z'
  return {
    schema: SCHEMA,
    nfts,
    users,
    sessions: [],
    favorites: { 'usr-ana': ['nft-002', 'nft-005'], 'usr-bruno': ['nft-010'] },
    carts: {},
    wallets: {
      'usr-ana': [
        { id: 'wal-ana-1', label: 'Principal', provider: 'metamask', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', network: 'ethereum', ensName: 'ana.kurio.eth', role: 'primary', createdAt: now, updatedAt: now },
      ],
      'usr-bruno': [
        { id: 'wal-bruno-1', label: 'Principal', provider: 'coinbase', address: '0x2546BcD3c84621e976D8185a91A922aE77ECEc30', network: 'ethereum', ensName: null, role: 'primary', createdAt: now, updatedAt: now },
        { id: 'wal-bruno-2', label: 'Reserva', provider: 'walletconnect', address: '0xbDA5747bFD65F08deb54cb465eB87D40e51B197E', network: 'polygon', ensName: 'nova.kurio.eth', role: 'secondary', createdAt: now, updatedAt: now },
      ],
    },
    quotes: {},
    orders: [],
    idempotency: {},
    seq: 1000,
  }
}

export function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage cheio ou bloqueado: segue só em memória */
  }
}

export async function initDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schema === SCHEMA) {
        state = parsed
        return
      }
    }
  } catch {
    /* ignora estado corrompido */
  }
  state = await seedState()
  persist()
}

export async function resetDb() {
  state = await seedState()
  persist()
}

// ---------- Helpers de domínio ----------
export const publicUser = (u: DbUser): User => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email,
  bio: u.bio,
  ensName: u.ensName,
  avatarUrl: u.avatarUrl,
  createdAt: u.createdAt,
})

export const findNft = (id: string) => state.nfts.find((n) => n.id === id)

export function findEdition(nftId: string, editionId: string) {
  const nft = findNft(nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  return { nft, edition }
}

export function getCart(key: string): DbCart {
  let cart = state.carts[key]
  if (!cart) {
    cart = { id: nextId('cart'), items: [], couponCode: null, version: 1, updatedAt: new Date().toISOString() }
    state.carts[key] = cart
  }
  return cart
}

export function touchCart(cart: DbCart) {
  cart.version += 1
  cart.updatedAt = new Date().toISOString()
}

export function findCoupon(code: string) {
  return COUPONS.find((c) => c.code.toUpperCase() === code.trim().toUpperCase())
}

export function couponIsExpired(code: string) {
  const c = findCoupon(code)
  return !c || Date.parse(c.expiresAt) < Date.now()
}

const networkFee = (network: Network) => NETWORKS.find((n) => n.value === network)?.feeEth ?? '0'

export function computeSummary(lines: { lineTotalEth: string }[], coupon: AppliedCoupon | null, network: Network): CartSummary {
  const subtotal = lines.length ? addEth(...lines.map((l) => l.lineTotalEth)) : '0'
  const discount = coupon ? toEth(eth(subtotal).times(coupon.percentOff).dividedBy(100)) : '0'
  const fee = lines.length ? networkFee(network) : '0'
  const total = toEth(eth(subtotal).minus(discount).plus(fee))
  return { subtotalEth: subtotal, discountEth: discount, networkFeeEth: fee, totalEth: total }
}

function appliedCoupon(code: string | null): AppliedCoupon | null {
  if (!code) return null
  const c = findCoupon(code)
  if (!c || Date.parse(c.expiresAt) < Date.now()) return null
  return { code: c.code, description: c.description, percentOff: c.percentOff }
}

export function cartIssues(cart: DbCart): CartIssue[] {
  const issues: CartIssue[] = []
  for (const item of cart.items) {
    const { nft, edition } = findEdition(item.nftId, item.editionId)
    if (!nft || !edition || edition.status === 'unavailable') {
      issues.push({ itemId: item.id, type: 'unavailable', message: 'Esta edição não está mais disponível.' })
      continue
    }
    if (edition.available === 0) {
      issues.push({ itemId: item.id, type: 'sold_out', message: `${nft.name} (${edition.name}) esgotou.` })
      continue
    }
    if (item.quantity > edition.available) {
      issues.push({ itemId: item.id, type: 'quantity_reduced', message: `Restam apenas ${edition.available} unidade(s) de ${nft.name} (${edition.name}).` })
    }
    if (compareEth(item.seenPriceEth, edition.priceEth) !== 0) {
      issues.push({ itemId: item.id, type: 'price_changed', message: `O preço de ${nft.name} (${edition.name}) mudou.` })
    }
  }
  return issues
}

export function serializeCart(cart: DbCart, network: Network = 'ethereum'): Cart {
  const items: CartItem[] = cart.items.map((item) => {
    const { nft, edition } = findEdition(item.nftId, item.editionId)
    const unit = edition?.priceEth ?? item.seenPriceEth
    return {
      id: item.id,
      nftId: item.nftId,
      editionId: item.editionId,
      name: nft?.name ?? 'NFT indisponível',
      editionName: edition?.name ?? '—',
      imageUrl: nft?.imageUrl ?? '',
      quantity: item.quantity,
      unitPriceEth: unit,
      lineTotalEth: toEth(eth(unit).times(item.quantity)),
      available: edition?.available ?? 0,
      maxPerOrder: edition?.maxPerOrder ?? 0,
      status: edition?.status ?? 'unavailable',
      previousUnitPriceEth: compareEth(item.seenPriceEth, unit) !== 0 ? item.seenPriceEth : null,
    }
  })
  const purchasable = items.filter((i) => i.status === 'available')
  const coupon = appliedCoupon(cart.couponCode)
  return {
    id: cart.id,
    items,
    coupon,
    summary: computeSummary(purchasable, coupon, network),
    issues: cartIssues(cart),
    version: cart.version,
    updatedAt: cart.updatedAt,
  }
}

function fingerprint(input: unknown) {
  // hash FNV-1a de 32 bits — suficiente para detectar mudança de conteúdo
  const s = JSON.stringify(input)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export const hashRequest = fingerprint

export function buildQuote(userId: string, cart: DbCart, network: Network): Quote & { userId: string } {
  const serialized = serializeCart(cart, network)
  const lines: QuoteLine[] = serialized.items
    .filter((i) => i.status === 'available')
    .map((i) => ({
      itemId: i.id,
      nftId: i.nftId,
      editionId: i.editionId,
      name: i.name,
      editionName: i.editionName,
      imageUrl: i.imageUrl,
      quantity: i.quantity,
      unitPriceEth: i.unitPriceEth,
      lineTotalEth: i.lineTotalEth,
    }))
  const issues = serialized.issues.filter((i) => i.type !== 'price_changed')
  const now = Date.now()
  const fp = fingerprint({ lines, coupon: serialized.coupon, summary: serialized.summary, network, issues })
  return {
    id: nextId('quo'),
    userId,
    network,
    lines,
    coupon: serialized.coupon,
    summary: serialized.summary,
    issues,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 5 * 60_000).toISOString(),
    fingerprint: fp,
  }
}

export function publicOrder(o: DbOrder): Order {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { settleAt: _s, plannedOutcome: _p, ...rest } = o
  return rest
}

export function sessionFromToken(token: string | null) {
  if (!token) return { session: null, expired: false }
  const session = state.sessions.find((s) => s.token === token)
  if (!session) return { session: null, expired: false }
  if (session.expiresAt <= Date.now()) return { session: null, expired: true }
  return { session, expired: false }
}

export function walletsOf(userId: string) {
  return (state.wallets[userId] ??= [])
}
