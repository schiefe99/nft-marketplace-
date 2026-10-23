import type {
  AddCartItemRequest,
  Cart,
  CatalogMeta,
  ChangePasswordRequest,
  CreateOrderRequest,
  FavoritesResponse,
  LoginRequest,
  Network,
  Nft,
  NftListParams,
  NftPage,
  Order,
  Quote,
  RegisterRequest,
  Session,
  UpdateProfileRequest,
  UpsertWalletRequest,
  User,
  Wallet,
  WalletConnection,
} from '@/contracts'
import { api } from './client'

const data = <T>(p: Promise<{ data: T }>) => p.then((r) => r.data)

export const authApi = {
  login: (body: LoginRequest) => data(api.post<Session>('/auth/login', body)),
  register: (body: RegisterRequest) => data(api.post<Session>('/auth/register', body)),
  session: (signal?: AbortSignal) => data(api.get<Session>('/auth/session', { signal })),
  logout: () => api.post('/auth/logout').then(() => undefined),
}

export const catalogApi = {
  meta: (signal?: AbortSignal) => data(api.get<CatalogMeta>('/catalog/meta', { signal })),
  list: (params: NftListParams, signal?: AbortSignal) =>
    data(
      api.get<NftPage>('/nfts', {
        params,
        signal,
        // category[] → category=a&category=b
        paramsSerializer: { indexes: null },
      }),
    ),
  detail: (id: string, signal?: AbortSignal) => data(api.get<Nft>(`/nfts/${encodeURIComponent(id)}`, { signal })),
}

export const favoritesApi = {
  list: (signal?: AbortSignal) => data(api.get<FavoritesResponse>('/me/favorites', { signal })),
  add: (nftId: string) => data(api.put<FavoritesResponse>(`/me/favorites/${nftId}`)),
  remove: (nftId: string) => data(api.delete<FavoritesResponse>(`/me/favorites/${nftId}`)),
}

export const cartApi = {
  get: (signal?: AbortSignal) => data(api.get<Cart>('/cart', { signal })),
  add: (body: AddCartItemRequest) => data(api.post<Cart>('/cart/items', body)),
  update: (itemId: string, quantity: number) => data(api.patch<Cart>(`/cart/items/${itemId}`, { quantity })),
  remove: (itemId: string) => data(api.delete<Cart>(`/cart/items/${itemId}`)),
  applyCoupon: (code: string) => data(api.post<Cart>('/cart/coupon', { code })),
  removeCoupon: () => data(api.delete<Cart>('/cart/coupon')),
  acknowledge: () => data(api.post<Cart>('/cart/acknowledge')),
  merge: () => data(api.post<Cart>('/cart/merge')),
}

export const checkoutApi = {
  quote: (network: Network) => data(api.post<Quote>('/checkout/quote', { network })),
  createOrder: (body: CreateOrderRequest, idempotencyKey: string) =>
    data(api.post<Order>('/orders', body, { headers: { 'Idempotency-Key': idempotencyKey } })),
  order: (id: string, signal?: AbortSignal) => data(api.get<Order>(`/orders/${id}`, { signal })),
  orders: (status?: Order['status'], signal?: AbortSignal) => data(api.get<Order[]>('/orders', { params: { status }, signal })),
}

export const accountApi = {
  profile: (signal?: AbortSignal) => data(api.get<User>('/me/profile', { signal })),
  updateProfile: (body: UpdateProfileRequest) => data(api.patch<User>('/me/profile', body)),
  changePassword: (body: ChangePasswordRequest) => api.post('/me/password', body).then(() => undefined),
  wallets: (signal?: AbortSignal) => data(api.get<Wallet[]>('/me/wallets', { signal })),
  createWallet: (body: UpsertWalletRequest) => data(api.post<Wallet>('/me/wallets', body)),
  updateWallet: (id: string, body: UpsertWalletRequest) => data(api.patch<Wallet>(`/me/wallets/${id}`, body)),
  connectWallet: (id: string, network: Network) => data(api.post<WalletConnection>(`/me/wallets/${id}/connect`, { network })),
}
