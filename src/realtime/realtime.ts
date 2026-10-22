import { io, type Socket } from 'socket.io-client'
import type { QueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { Cart, Nft, NftSummary, NftUpdatedEvent, Order, OrderUpdatedEvent, Paginated, ServerToClientEvents } from '@/contracts'
import { qk } from '@/api/query'

/**
 * Cliente de tempo real.
 *  - Deduplica por `eventId` e ignora versões antigas (nunca regride estado).
 *  - Ao reconectar, reconcilia os recursos ativos com a API REST (invalidate).
 *  - Cada sessão tem seu próprio socket; trocar de usuário destrói o anterior,
 *    e eventos privados de outro usuário são descartados.
 */
export type ConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting'

type BusEvent =
  | { type: 'nft.changed'; nftId: string; inCart: boolean; name: string; priceChanged: boolean; availabilityChanged: boolean }
  | { type: 'order.changed'; order: Order }
  | { type: 'reconciled' }

const MAX_SEEN = 500

class RealtimeClient {
  private socket: Socket<ServerToClientEvents> | null = null
  private seen = new Set<string>()
  private versions = new Map<string, number>()
  private userId: string | null = null
  private qc: QueryClient | null = null
  private hadConnection = false
  private state: ConnectionState = 'idle'
  private stateListeners = new Set<() => void>()
  private bus = new EventTarget()

  getState = () => this.state
  subscribeState = (l: () => void) => {
    this.stateListeners.add(l)
    return () => {
      this.stateListeners.delete(l)
    }
  }
  private setState(s: ConnectionState) {
    this.state = s
    this.stateListeners.forEach((l) => l())
  }

  on(listener: (e: BusEvent) => void) {
    const handler = (ev: Event) => listener((ev as CustomEvent<BusEvent>).detail)
    this.bus.addEventListener('evt', handler)
    return () => this.bus.removeEventListener('evt', handler)
  }
  private publish(e: BusEvent) {
    this.bus.dispatchEvent(new CustomEvent('evt', { detail: e }))
  }

  connect(qc: QueryClient, token: string | null, userId: string | null) {
    this.disconnect()
    this.qc = qc
    this.userId = userId
    this.hadConnection = false
    const url = import.meta.env.VITE_SOCKET_URL ?? window.location.origin
    const socket: Socket<ServerToClientEvents> = io(url, {
      transports: ['websocket'],
      query: token ? { token } : {},
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    })
    this.socket = socket
    this.setState('connecting')

    socket.on('connect', () => {
      if (this.hadConnection) this.reconcile()
      this.hadConnection = true
      this.setState('connected')
    })
    socket.on('disconnect', () => {
      if (this.socket === socket) this.setState('reconnecting')
    })
    socket.io.on('reconnect_attempt', () => this.setState('reconnecting'))
    socket.on('nft.updated', (event) => this.handleNft(event))
    socket.on('order.updated', (event) => this.handleOrder(event))
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners()
      this.socket.io.removeAllListeners()
      this.socket.disconnect()
    }
    this.socket = null
    this.userId = null
    this.seen.clear()
    this.setState('idle')
  }

  /** Apenas para testes/demonstração: derruba a conexão do lado do cliente. */
  simulateDrop() {
    this.socket?.io.engine?.close()
  }

  private accept(eventId: string, key: string, version: number) {
    if (this.seen.has(eventId)) return false
    this.seen.add(eventId)
    if (this.seen.size > MAX_SEEN) this.seen.delete(this.seen.values().next().value!)
    const current = this.versions.get(key) ?? 0
    if (version <= current) return false
    this.versions.set(key, version)
    return true
  }

  private reconcile() {
    const qc = this.qc
    if (!qc) return
    // Reconsulta somente o que está em tela; o resto fica stale para a próxima leitura
    void qc.invalidateQueries({ queryKey: ['nfts'], refetchType: 'active' })
    void qc.invalidateQueries({ queryKey: ['cart'], refetchType: 'active' })
    if (this.userId) void qc.invalidateQueries({ queryKey: ['private', this.userId], refetchType: 'active' })
    this.publish({ type: 'reconciled' })
  }

  private handleNft(event: NftUpdatedEvent) {
    const qc = this.qc
    if (!qc) return
    const { nftId } = event.data
    const cachedDetail = qc.getQueryData<Nft>(qk.nft(nftId))
    // versão REST já mais nova que o evento → descarta
    if (cachedDetail && cachedDetail.version >= event.version) {
      this.versions.set(`nft:${nftId}`, Math.max(this.versions.get(`nft:${nftId}`) ?? 0, cachedDetail.version))
    }
    if (!this.accept(event.eventId, `nft:${nftId}`, event.version)) return

    let priceChanged = false
    let availabilityChanged = false
    qc.setQueryData<Nft>(qk.nft(nftId), (prev) => {
      if (!prev || prev.version >= event.version) return prev
      priceChanged = prev.priceEth !== event.data.priceEth || prev.editions.some((e) => event.data.editions.find((x) => x.id === e.id)?.priceEth !== e.priceEth)
      availabilityChanged = prev.totalAvailable !== event.data.totalAvailable
      return {
        ...prev,
        priceEth: event.data.priceEth,
        totalAvailable: event.data.totalAvailable,
        version: event.version,
        editions: prev.editions.map((e) => {
          const upd = event.data.editions.find((x) => x.id === e.id)
          return upd ? { ...e, ...upd } : e
        }),
      }
    })
    qc.setQueriesData<Paginated<NftSummary>>({ queryKey: qk.nftLists }, (prev) => {
      if (!prev) return prev
      let changed = false
      const items = prev.items.map((n) => {
        if (n.id !== nftId || n.version >= event.version) return n
        changed = true
        if (n.priceEth !== event.data.priceEth) priceChanged = true
        if (n.totalAvailable !== event.data.totalAvailable) availabilityChanged = true
        return { ...n, priceEth: event.data.priceEth, totalAvailable: event.data.totalAvailable, version: event.version }
      })
      return changed ? { ...prev, items } : prev
    })

    // Carrinho: resumo é calculado pela API → reconsulta
    const carts = qc.getQueriesData<Cart>({ queryKey: ['cart'] })
    const cartItem = carts.flatMap(([, c]) => c?.items ?? []).find((i) => i.nftId === nftId)
    if (cartItem) {
      const upd = event.data.editions.find((e) => e.id === cartItem.editionId)
      if (upd) {
        priceChanged ||= upd.priceEth !== cartItem.unitPriceEth
        availabilityChanged ||= upd.available !== cartItem.available
      }
      void qc.invalidateQueries({ queryKey: ['cart'] })
    }
    // Listas filtradas por preço/disponibilidade podem mudar de composição
    void qc.invalidateQueries({ queryKey: qk.nftLists, refetchType: 'none' })
    this.publish({
      type: 'nft.changed',
      nftId,
      inCart: Boolean(cartItem),
      name: cartItem?.name ?? cachedDetail?.name ?? '',
      priceChanged,
      availabilityChanged,
    })
  }

  private handleOrder(event: OrderUpdatedEvent) {
    const qc = this.qc
    // Isolamento: eventos de outro usuário/sessão anterior são ignorados
    if (!qc || !this.userId || event.userId !== this.userId || event.data.order.userId !== this.userId) return
    if (!this.accept(event.eventId, `order:${event.resource.id}`, event.version)) return
    const userId = this.userId
    qc.setQueryData<Order>(qk.order(userId, event.data.order.id), (prev) =>
      prev && prev.version >= event.version ? prev : event.data.order,
    )
    void qc.invalidateQueries({ queryKey: qk.orders(userId), exact: true })
    if (event.data.order.status === 'confirmed') void qc.invalidateQueries({ queryKey: ['cart'] })
    this.publish({ type: 'order.changed', order: event.data.order })
  }
}

export const realtime = new RealtimeClient()

export function useConnectionState() {
  return useSyncExternalStore(realtime.subscribeState, realtime.getState, realtime.getState)
}
