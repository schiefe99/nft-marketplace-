/**
 * Servidor Socket.IO simulado com MSW (`ws.link`) + @mswjs/socket.io-binding.
 * O app usa o `socket.io-client` real; o MSW intercepta o WebSocket na página.
 *
 * Limitações do transporte simulado (documentadas em docs/ARCHITECTURE.md):
 *  - apenas transporte `websocket` (sem long-polling);
 *  - namespace único `/`, sem rooms — o isolamento por usuário é feito aqui,
 *    filtrando conexões pelo token enviado na query do handshake;
 *  - o ping do Engine.IO é emitido manualmente a cada 20 s.
 */
import { ws } from 'msw'
import { toSocketIo } from '@mswjs/socket.io-binding'
import type { NftUpdatedEvent, Order, OrderUpdatedEvent } from '@/contracts'
import { db, findNft, persist, sessionFromToken } from './db'

// O MSW remove o prefixo "/socket.io/" do caminho ao casar URLs de WebSocket,
// então o link é a própria origem do servidor de tempo real.
const SOCKET_ORIGIN = (import.meta.env.VITE_SOCKET_URL ?? window.location.origin).replace(/^http/, 'ws')
const socketLink = ws.link(`${SOCKET_ORIGIN}/`)

interface LiveConnection {
  id: number
  userId: string | null
  io: ReturnType<typeof toSocketIo>
  close: () => void
}

const connections = new Map<number, LiveConnection>()
let connCounter = 0
const history: (NftUpdatedEvent | OrderUpdatedEvent)[] = []

export const socketHandlers = [
  socketLink.addEventListener('connection', (connection) => {
    const url = new URL(connection.client.url)
    const token = url.searchParams.get('token')
    const { session } = sessionFromToken(token)
    const id = ++connCounter
    const io = toSocketIo(connection)
    const ping = setInterval(() => {
      try {
        connection.client.send('2')
      } catch {
        /* conexão já fechada */
      }
    }, 20_000)
    const live: LiveConnection = {
      id,
      userId: session?.userId ?? null,
      io,
      close: () => connection.client.close(),
    }
    connections.set(id, live)
    connection.client.addEventListener('close', () => {
      clearInterval(ping)
      connections.delete(id)
    })
  }),
]

function nextEventId() {
  const s = db()
  s.seq += 1
  persist()
  return `evt-${s.seq.toString(36)}`
}

export function emitNftUpdated(nftId: string) {
  const nft = findNft(nftId)
  if (!nft) return null
  const event: NftUpdatedEvent = {
    eventId: nextEventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nftId },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: {
      nftId,
      priceEth: nft.priceEth,
      totalAvailable: nft.totalAvailable,
      editions: nft.editions.map((e) => ({ id: e.id, priceEth: e.priceEth, available: e.available, status: e.status })),
    },
  }
  history.push(event)
  for (const c of connections.values()) c.io.client.emit('nft.updated', event)
  return event
}

export function emitOrderUpdated(order: Order) {
  const event: OrderUpdatedEvent = {
    eventId: nextEventId(),
    type: 'order.updated',
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: new Date().toISOString(),
    userId: order.userId,
    data: { order },
  }
  history.push(event)
  // Isolamento: somente conexões autenticadas do dono do pedido recebem o evento
  for (const c of connections.values()) if (c.userId === order.userId) c.io.client.emit('order.updated', event)
  return event
}

/** Reenvia um evento já emitido (para testar duplicatas e eventos antigos). */
export function replayEvent(eventId: string) {
  const event = history.find((e) => e.eventId === eventId)
  if (!event) return false
  for (const c of connections.values()) {
    if (event.type === 'order.updated' && c.userId !== event.userId) continue
    c.io.client.emit(event.type, event)
  }
  return true
}

export const eventHistory = () => [...history]

export function dropAllConnections() {
  for (const c of connections.values()) c.close()
}

export const connectionCount = () => connections.size
