/**
 * Contratos compartilhados entre mocks (MSW), cliente HTTP, cache e UI.
 * Valores em ETH trafegam SEMPRE como string decimal (ex.: "0.125").
 * Quantidades são inteiros.
 */

export type EthAmount = string
export type ISODate = string

// ---------- Erros ----------
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_EXPIRED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'AVAILABILITY_CONFLICT'
  | 'COUPON_INVALID'
  | 'COUPON_EXPIRED'
  | 'QUOTE_STALE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'ORDER_PENDING'
  | 'WALLET_REJECTED'
  | 'WRONG_PASSWORD'
  | 'TRANSIENT_FAILURE'
  | 'INTERNAL_ERROR'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** Erros por campo (nome do campo -> mensagem) */
    fields?: Record<string, string>
    /** Dados extras (ex.: nova cotação em QUOTE_STALE) */
    details?: unknown
  }
}

// ---------- Sessão e conta ----------
export interface User {
  id: string
  name: string
  email: string
  username: string
  bio: string
  ensName: string | null
  avatarUrl: string | null
  createdAt: ISODate
}

export interface Session {
  user: User
  token: string
  expiresAt: ISODate
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  name: string
  username: string
  email: string
  password: string
}

export interface UpdateProfileRequest {
  name?: string
  username?: string
  email?: string
  bio?: string
  ensName?: string | null
  /** data URL (image/png|jpeg|webp) ou null para remover */
  avatarUrl?: string | null
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

// ---------- NFTs ----------
export type EditionStatus = 'available' | 'sold_out' | 'unavailable'

export interface Edition {
  id: string
  name: string
  priceEth: EthAmount
  /** Unidades disponíveis para compra */
  available: number
  /** Limite por pedido */
  maxPerOrder: number
  status: EditionStatus
}

export interface Creator {
  id: string
  name: string
  avatarUrl: string
}

export type Rarity = 'common' | 'rare' | 'legendary'
export type CatalogTab = 'all' | 'new' | 'trending'

export interface NftSummary {
  id: string
  tokenId: string
  name: string
  rarity: Rarity
  rating: { average: number; count: number }
  isNew: boolean
  isTrending: boolean
  imageUrl: string
  collection: string
  category: Category
  creator: Creator
  /** Menor preço entre as edições disponíveis */
  priceEth: EthAmount
  highestBidEth: EthAmount
  totalAvailable: number
  createdAt: ISODate
  version: number
}

export interface Nft extends NftSummary {
  description: string
  gallery: string[]
  tags: string[]
  editions: Edition[]
  attributes: string[]
  royaltyPercent: number
  contractAddress: string
  chain: Network
}

export type Category =
  | 'digital-art'
  | 'photography'
  | 'music'
  | '3d'
  | 'collectibles'
  | 'generative'
  | 'gaming'
  | 'subscriptions'
  | 'utility'

/** Rótulos conforme a barra lateral "Coleções" do Figma. */
export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'digital-art', label: 'Arte digital' },
  { value: 'photography', label: 'Fotografia' },
  { value: 'music', label: 'Música' },
  { value: '3d', label: 'Arte 3D' },
  { value: 'collectibles', label: 'Colecionáveis' },
  { value: 'generative', label: 'Generativa' },
  { value: 'gaming', label: 'Jogos' },
  { value: 'subscriptions', label: 'Assinaturas' },
  { value: 'utility', label: 'Utilidade' },
]

export type NftSort = 'recent' | 'price-asc' | 'price-desc' | 'name'
export type AvailabilityFilter = 'all' | 'available' | 'sold_out'

export interface NftListParams {
  tab?: CatalogTab
  network?: Network
  /** Restringe a uma lista de ids (ex.: favoritos) */
  ids?: string[]
  q?: string
  category?: Category[]
  collection?: string
  minPrice?: string
  maxPrice?: string
  availability?: AvailabilityFilter
  sort?: NftSort
  page?: number
  pageSize?: number
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/**
 * Contagens por faceta considerando os demais filtros ativos (a própria faceta
 * é ignorada): o número ao lado de "Polygon" é o que aparece ao clicar nele.
 */
export interface NftFacets {
  categories: Partial<Record<Category, number>>
  networks: Partial<Record<Network, number>>
}

export interface NftPage extends Paginated<NftSummary> {
  facets: NftFacets
}

export interface CatalogMeta {
  collections: string[]
  categories: { value: Category; label: string; count: number }[]
  networks: { value: Network; label: string; count: number }[]
  priceRange: { min: EthAmount; max: EthAmount }
  featured: NftSummary[]
  stats: { totalSales: string; auctions: string; artists: string }
}

// ---------- Favoritos ----------
export interface FavoritesResponse {
  nftIds: string[]
}

// ---------- Carrinho ----------
export interface CartItem {
  id: string
  nftId: string
  editionId: string
  name: string
  editionName: string
  imageUrl: string
  quantity: number
  unitPriceEth: EthAmount
  lineTotalEth: EthAmount
  available: number
  maxPerOrder: number
  status: EditionStatus
  /** Preço registrado quando o item foi adicionado/visto pela última vez */
  previousUnitPriceEth: EthAmount | null
}

export interface CartSummary {
  subtotalEth: EthAmount
  discountEth: EthAmount
  networkFeeEth: EthAmount
  totalEth: EthAmount
}

export interface AppliedCoupon {
  code: string
  description: string
  percentOff: number
}

export interface Cart {
  id: string
  items: CartItem[]
  coupon: AppliedCoupon | null
  summary: CartSummary
  /** Itens com preço/disponibilidade alterados desde a última leitura */
  issues: CartIssue[]
  version: number
  updatedAt: ISODate
}

export type CartIssueType = 'price_changed' | 'sold_out' | 'quantity_reduced' | 'unavailable'

export interface CartIssue {
  itemId: string
  type: CartIssueType
  message: string
}

export interface AddCartItemRequest {
  nftId: string
  editionId: string
  quantity: number
}

export interface UpdateCartItemRequest {
  quantity: number
}

// ---------- Cotação ----------
export type Network = 'ethereum' | 'polygon' | 'solana'

export const NETWORKS: { value: Network; label: string; feeEth: EthAmount }[] = [
  { value: 'ethereum', label: 'Ethereum', feeEth: '0.016' },
  { value: 'polygon', label: 'Polygon', feeEth: '0.0021' },
  { value: 'solana', label: 'Solana', feeEth: '0.0008' },
]

export interface QuoteRequest {
  network: Network
}

export interface QuoteLine {
  itemId: string
  nftId: string
  editionId: string
  name: string
  editionName: string
  imageUrl: string
  quantity: number
  unitPriceEth: EthAmount
  lineTotalEth: EthAmount
}

export interface Quote {
  id: string
  network: Network
  lines: QuoteLine[]
  coupon: AppliedCoupon | null
  summary: CartSummary
  issues: CartIssue[]
  createdAt: ISODate
  expiresAt: ISODate
  /** Hash do conteúdo — muda se preço, disponibilidade, cupom ou taxa mudarem */
  fingerprint: string
}

// ---------- Carteiras ----------
export type WalletProvider = 'metamask' | 'coinbase' | 'walletconnect'
export type WalletRole = 'primary' | 'secondary'

export interface Wallet {
  id: string
  label: string
  provider: WalletProvider
  address: string
  network: Network
  ensName: string | null
  role: WalletRole
  createdAt: ISODate
  updatedAt: ISODate
}

export interface UpsertWalletRequest {
  label: string
  provider: WalletProvider
  address: string
  network: Network
  ensName?: string | null
  role: WalletRole
}

export interface ConnectWalletRequest {
  network: Network
}

export interface WalletConnection {
  walletId: string
  network: Network
  connected: boolean
  connectedAt: ISODate
}

// ---------- Pedidos ----------
export type OrderStatus = 'pending' | 'confirmed' | 'declined'

export interface BuyerInfo {
  fullName: string
  username: string
  email: string
  referralCode?: string
  note?: string
}

export interface CreateOrderRequest {
  quoteId: string
  quoteFingerprint: string
  walletId: string
  network: Network
  buyer: BuyerInfo
}

export interface Order {
  id: string
  userId: string
  status: OrderStatus
  network: Network
  wallet: Pick<Wallet, 'id' | 'label' | 'address' | 'provider'>
  buyer: BuyerInfo
  lines: QuoteLine[]
  coupon: AppliedCoupon | null
  summary: CartSummary
  txHash: string | null
  explorerUrl: string | null
  failureReason: string | null
  createdAt: ISODate
  updatedAt: ISODate
  version: number
}

// ---------- Eventos em tempo real (Socket.IO) ----------
export interface RealtimeEnvelope<TType extends string, TData> {
  /** Identidade estável do evento (deduplicação) */
  eventId: string
  type: TType
  resource: { type: 'nft' | 'order'; id: string }
  /** Versão do recurso após a mudança (monotônica) */
  version: number
  occurredAt: ISODate
  /** Usuário dono do recurso (eventos privados) */
  userId?: string
  data: TData
}

export type NftUpdatedEvent = RealtimeEnvelope<
  'nft.updated',
  {
    nftId: string
    priceEth: EthAmount
    totalAvailable: number
    editions: Pick<Edition, 'id' | 'priceEth' | 'available' | 'status'>[]
  }
>

export type OrderUpdatedEvent = RealtimeEnvelope<'order.updated', { order: Order }>

export interface ServerToClientEvents {
  'nft.updated': (event: NftUpdatedEvent) => void
  'order.updated': (event: OrderUpdatedEvent) => void
}
