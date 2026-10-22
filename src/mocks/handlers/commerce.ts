import { http, HttpResponse } from 'msw'
import type {
  AddCartItemRequest,
  Cart,
  ConnectWalletRequest,
  CreateOrderRequest,
  Network,
  Order,
  Quote,
  UpdateCartItemRequest,
  UpsertWalletRequest,
  Wallet,
  WalletConnection,
} from '@/contracts'
import { NETWORKS } from '@/contracts'
import { eth, toEth } from '@/lib/money'
import {
  buildQuote,
  couponIsExpired,
  db,
  type DbOrder,
  findCoupon,
  findEdition,
  findNft,
  getCart,
  hashRequest,
  nextId,
  persist,
  publicOrder,
  recomputeNft,
  serializeCart,
  touchCart,
  walletsOf,
} from '../db'
import { cartKey, ETH_ADDRESS_RE, SOL_ADDRESS_RE, fail, readJson, requireUser, route } from '../http-utils'
import { config, has } from '../scenarios'
import { emitNftUpdated, emitOrderUpdated } from '../socket'

const isNetwork = (n: unknown): n is Network => NETWORKS.some((x) => x.value === n)

// ---------- Mutação administrativa de NFT (usada por cenários, painel e testes) ----------
export function updateNft(nftId: string, patch: { editionId?: string; priceEth?: string; available?: number; priceFactor?: string }) {
  const nft = findNft(nftId)
  if (!nft) return null
  const edition = patch.editionId ? nft.editions.find((e) => e.id === patch.editionId) : nft.editions[0]
  if (!edition) return null
  if (patch.priceFactor) edition.priceEth = toEth(eth(edition.priceEth).times(patch.priceFactor).toDecimalPlaces(6))
  if (patch.priceEth) edition.priceEth = patch.priceEth
  if (patch.available !== undefined) edition.available = Math.max(0, patch.available)
  nft.version += 1
  recomputeNft(nft)
  persist()
  return emitNftUpdated(nft.id)
}

// ---------- Liquidação simulada de pedidos ----------
const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function settleOrder(orderId: string, outcome: 'confirmed' | 'declined') {
  const order = db().orders.find((o) => o.id === orderId)
  if (!order || order.status !== 'pending') return null
  timers.delete(orderId)
  let finalOutcome = outcome
  let reason: string | null = outcome === 'declined' ? 'A carteira recusou a assinatura da transação.' : null
  if (finalOutcome === 'confirmed') {
    // verificação final de disponibilidade
    for (const line of order.lines) {
      const { edition } = findEdition(line.nftId, line.editionId)
      if (!edition || edition.available < line.quantity) {
        finalOutcome = 'declined'
        reason = `Disponibilidade insuficiente para ${line.name} (${line.editionName}).`
      }
    }
  }
  const touched = new Set<string>()
  if (finalOutcome === 'confirmed') {
    for (const line of order.lines) {
      const { nft, edition } = findEdition(line.nftId, line.editionId)
      if (!nft || !edition) continue
      edition.available -= line.quantity
      nft.version += 1
      recomputeNft(nft)
      touched.add(nft.id)
    }
    // Remove do carrinho apenas os itens/quantidades comprados
    const cart = db().carts[`user:${order.userId}`]
    if (cart) {
      for (const line of order.lines) {
        const item = cart.items.find((i) => i.editionId === line.editionId)
        if (!item) continue
        item.quantity -= line.quantity
        if (item.quantity <= 0) cart.items = cart.items.filter((i) => i !== item)
      }
      cart.couponCode = null
      touchCart(cart)
    }
    order.txHash = `0x${hashRequest({ id: order.id, t: Date.now() })}${'0'.repeat(48)}${hashRequest(order.lines)}`.slice(0, 66)
    order.explorerUrl = `https://explorer.simulado.dev/${order.network}/tx/${order.txHash}`
  }
  order.status = finalOutcome
  order.failureReason = reason
  order.version += 1
  order.updatedAt = new Date().toISOString()
  order.settleAt = null
  persist()
  touched.forEach((id) => emitNftUpdated(id))
  emitOrderUpdated(publicOrder(order))
  return publicOrder(order)
}

function schedule(order: DbOrder) {
  if (order.status !== 'pending' || order.settleAt === null || order.plannedOutcome === 'hold') return
  clearTimeout(timers.get(order.id))
  const wait = Math.max(50, order.settleAt - Date.now())
  const outcome = order.plannedOutcome
  timers.set(order.id, setTimeout(() => settleOrder(order.id, outcome), wait))
}

/** Reagenda pedidos pendentes após refresh da página. */
export function resumePendingOrders() {
  db().orders.filter((o) => o.status === 'pending').forEach(schedule)
}

export function clearOrderTimers() {
  timers.forEach((t) => clearTimeout(t))
  timers.clear()
}

let priceChangeArmed = true
export function rearmScenarioTriggers() {
  priceChangeArmed = true
}

// ---------- Handlers ----------
export const commerceHandlers = [
  // Carrinho (visitante ou usuário)
  http.get('/api/cart', route(({ request }) => {
    const { key } = cartKey(request)
    return HttpResponse.json<Cart>(serializeCart(getCart(key)))
  })),

  http.post('/api/cart/items', route(async ({ request }) => {
    const { key } = cartKey(request)
    const body = await readJson<AddCartItemRequest>(request)
    if (!Number.isInteger(body.quantity) || body.quantity < 1) throw fail(422, 'VALIDATION_ERROR', 'Quantidade inválida.', { fields: { quantity: 'Informe uma quantidade inteira maior que zero.' } })
    const { nft, edition } = findEdition(body.nftId, body.editionId)
    if (!nft || !edition) throw fail(404, 'NOT_FOUND', 'Edição não encontrada.')
    if (edition.status !== 'available') throw fail(409, 'AVAILABILITY_CONFLICT', 'Esta edição não está disponível.')
    const cart = getCart(key)
    const existing = cart.items.find((i) => i.editionId === edition.id)
    const nextQty = (existing?.quantity ?? 0) + body.quantity
    if (nextQty > edition.maxPerOrder) throw fail(422, 'VALIDATION_ERROR', `Limite de ${edition.maxPerOrder} unidade(s) por pedido.`, { fields: { quantity: `Máximo de ${edition.maxPerOrder} por pedido.` } })
    if (nextQty > edition.available) throw fail(409, 'AVAILABILITY_CONFLICT', `Apenas ${edition.available} unidade(s) disponível(is).`)
    if (existing) {
      existing.quantity = nextQty
      existing.seenPriceEth = edition.priceEth
    } else {
      cart.items.push({ id: nextId('itm'), nftId: nft.id, editionId: edition.id, quantity: body.quantity, seenPriceEth: edition.priceEth })
    }
    touchCart(cart)
    persist()
    return HttpResponse.json<Cart>(serializeCart(cart), { status: 201 })
  })),

  http.patch('/api/cart/items/:itemId', route(async ({ request, params }) => {
    const { key } = cartKey(request)
    const body = await readJson<UpdateCartItemRequest>(request)
    const cart = getCart(key)
    const item = cart.items.find((i) => i.id === params.itemId)
    if (!item) throw fail(404, 'NOT_FOUND', 'Item não está no carrinho.')
    if (!Number.isInteger(body.quantity) || body.quantity < 1) throw fail(422, 'VALIDATION_ERROR', 'Quantidade inválida.', { fields: { quantity: 'Informe uma quantidade inteira maior que zero.' } })
    const { edition } = findEdition(item.nftId, item.editionId)
    if (!edition || edition.status !== 'available') throw fail(409, 'AVAILABILITY_CONFLICT', 'Esta edição não está mais disponível.')
    if (body.quantity > edition.maxPerOrder) throw fail(422, 'VALIDATION_ERROR', `Limite de ${edition.maxPerOrder} unidade(s) por pedido.`, { fields: { quantity: `Máximo de ${edition.maxPerOrder} por pedido.` } })
    if (body.quantity > edition.available) throw fail(409, 'AVAILABILITY_CONFLICT', `Apenas ${edition.available} unidade(s) disponível(is).`)
    item.quantity = body.quantity
    touchCart(cart)
    persist()
    return HttpResponse.json<Cart>(serializeCart(cart))
  })),

  http.delete('/api/cart/items/:itemId', route(({ request, params }) => {
    const { key } = cartKey(request)
    const cart = getCart(key)
    if (!cart.items.some((i) => i.id === params.itemId)) throw fail(404, 'NOT_FOUND', 'Item não está no carrinho.')
    cart.items = cart.items.filter((i) => i.id !== params.itemId)
    touchCart(cart)
    persist()
    return HttpResponse.json<Cart>(serializeCart(cart))
  })),

  http.post('/api/cart/coupon', route(async ({ request }) => {
    const { key } = cartKey(request)
    const { code } = await readJson<{ code: string }>(request)
    if (!code?.trim()) throw fail(422, 'VALIDATION_ERROR', 'Informe um cupom.', { fields: { code: 'Informe um cupom.' } })
    if (!findCoupon(code)) throw fail(422, 'COUPON_INVALID', 'Cupom inválido.', { fields: { code: 'Cupom inválido.' } })
    if (couponIsExpired(code)) throw fail(422, 'COUPON_EXPIRED', 'Este cupom expirou.', { fields: { code: 'Este cupom expirou.' } })
    const cart = getCart(key)
    cart.couponCode = findCoupon(code)!.code
    touchCart(cart)
    persist()
    return HttpResponse.json<Cart>(serializeCart(cart))
  })),

  http.delete('/api/cart/coupon', route(({ request }) => {
    const { key } = cartKey(request)
    const cart = getCart(key)
    cart.couponCode = null
    touchCart(cart)
    persist()
    return HttpResponse.json<Cart>(serializeCart(cart))
  })),

  /** Usuário reconhece alterações de preço — novos preços passam a ser a referência. */
  http.post('/api/cart/acknowledge', route(({ request }) => {
    const { key } = cartKey(request)
    const cart = getCart(key)
    for (const item of cart.items) {
      const { edition } = findEdition(item.nftId, item.editionId)
      if (edition) item.seenPriceEth = edition.priceEth
    }
    touchCart(cart)
    persist()
    return HttpResponse.json<Cart>(serializeCart(cart))
  })),

  /** Mescla o carrinho do visitante no carrinho do usuário autenticado. */
  http.post('/api/cart/merge', route(({ request }) => {
    const { user } = requireUser(request)
    const guestId = request.headers.get('x-guest-id')
    const target = getCart(`user:${user.id}`)
    const guestKey = guestId ? `guest:${guestId}` : null
    const guest = guestKey ? db().carts[guestKey] : undefined
    if (guest && guest.items.length) {
      for (const g of guest.items) {
        const { edition } = findEdition(g.nftId, g.editionId)
        if (!edition) continue
        const existing = target.items.find((i) => i.editionId === g.editionId)
        const cap = Math.max(0, Math.min(edition.maxPerOrder, edition.available))
        if (existing) existing.quantity = Math.max(1, Math.min(cap, existing.quantity + g.quantity))
        else if (cap > 0) target.items.push({ ...g, id: nextId('itm'), quantity: Math.min(cap, g.quantity) })
      }
      if (!target.couponCode && guest.couponCode) target.couponCode = guest.couponCode
      delete db().carts[guestKey!]
      touchCart(target)
      persist()
    }
    return HttpResponse.json<Cart>(serializeCart(target))
  })),

  // Cotação (revalida preço, disponibilidade, cupom e taxa)
  http.post('/api/checkout/quote', route(async ({ request }) => {
    const { user } = requireUser(request)
    const { network } = await readJson<{ network: Network }>(request)
    if (!isNetwork(network)) throw fail(422, 'VALIDATION_ERROR', 'Rede inválida.', { fields: { network: 'Selecione uma rede.' } })
    const cart = getCart(`user:${user.id}`)
    if (!cart.items.length) throw fail(422, 'VALIDATION_ERROR', 'Seu carrinho está vazio.')
    if (cart.couponCode && couponIsExpired(cart.couponCode)) {
      cart.couponCode = null
      touchCart(cart)
    }
    const quote = buildQuote(user.id, cart, network)
    db().quotes[quote.id] = quote
    persist()
    if (has('price-change-during-checkout') && priceChangeArmed && quote.lines[0]) {
      priceChangeArmed = false
      const line = quote.lines[0]
      setTimeout(() => updateNft(line.nftId, { editionId: line.editionId, priceFactor: '1.1' }), 3000)
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userId: _u, ...pub } = quote
    return HttpResponse.json<Quote>(pub)
  })),

  // Pedidos
  http.post('/api/orders', route(async ({ request }) => {
    const { user } = requireUser(request)
    const key = request.headers.get('idempotency-key')
    if (!key || key.length < 8) throw fail(400, 'VALIDATION_ERROR', 'Cabeçalho Idempotency-Key obrigatório.')
    const body = await readJson<CreateOrderRequest>(request)
    const requestHash = hashRequest({ userId: user.id, body })
    const s = db()
    const prior = s.idempotency[key]
    if (prior) {
      if (prior.userId !== user.id || prior.requestHash !== requestHash) {
        throw fail(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
      }
      const existing = s.orders.find((o) => o.id === prior.orderId)!
      return HttpResponse.json<Order>(publicOrder(existing), { status: 200 })
    }

    const fields: Record<string, string> = {}
    if (!body.buyer?.fullName || body.buyer.fullName.trim().length < 3) fields.fullName = 'Informe o nome completo.'
    if (!body.buyer?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.buyer.email)) fields.email = 'Informe um e-mail válido.'
    if (!body.buyer?.username || body.buyer.username.trim().length < 3) fields.username = 'Informe o nome de usuário.'
    if (body.buyer?.referralCode && !/^[A-Z0-9-]{4,16}$/i.test(body.buyer.referralCode)) fields.referralCode = 'Código de indicação inválido.'
    if (body.buyer?.note && body.buyer.note.length > 280) fields.note = 'Máximo de 280 caracteres.'
    if (!isNetwork(body.network)) fields.network = 'Selecione uma rede.'
    if (Object.keys(fields).length) throw fail(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields })

    const pending = s.orders.find((o) => o.userId === user.id && o.status === 'pending')
    if (pending) throw fail(409, 'ORDER_PENDING', 'Você já tem um pedido pendente. Aguarde a confirmação antes de criar outro.', { details: { orderId: pending.id } })

    const wallet = walletsOf(user.id).find((w) => w.id === body.walletId)
    if (!wallet) throw fail(403, 'FORBIDDEN', 'Carteira não pertence a este usuário.')

    const cart = getCart(`user:${user.id}`)
    const quote = s.quotes[body.quoteId]
    if (!quote || quote.userId !== user.id) throw fail(409, 'QUOTE_STALE', 'Cotação não encontrada. Revise o pedido.')
    const fresh = buildQuote(user.id, cart, body.network)
    if (fresh.issues.length) {
      s.quotes[fresh.id] = fresh
      persist()
      throw fail(409, 'AVAILABILITY_CONFLICT', 'A disponibilidade de alguns itens mudou.', { details: { quote: fresh } })
    }
    if (Date.parse(quote.expiresAt) < Date.now() || fresh.fingerprint !== body.quoteFingerprint) {
      s.quotes[fresh.id] = fresh
      persist()
      throw fail(409, 'QUOTE_STALE', 'Preço, cupom ou taxa mudaram. Revise e confirme novamente.', { details: { quote: fresh } })
    }

    const now = Date.now()
    const order: DbOrder = {
      id: nextId('ord'),
      userId: user.id,
      status: 'pending',
      network: body.network,
      wallet: { id: wallet.id, label: wallet.label, address: wallet.address, provider: wallet.provider },
      buyer: body.buyer,
      lines: fresh.lines.map((l) => ({ ...l })),
      coupon: fresh.coupon,
      summary: { ...fresh.summary },
      txHash: null,
      explorerUrl: null,
      failureReason: null,
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      version: 1,
      plannedOutcome: has('pending-hold') ? 'hold' : has('payment-declined') ? 'declined' : 'confirmed',
      settleAt: has('pending-hold') ? null : now + config.settleDelayMs,
    }
    s.orders.push(order)
    s.idempotency[key] = { userId: user.id, requestHash, orderId: order.id, responseDropped: false }
    persist()
    schedule(order)

    if (has('order-timeout') && !s.idempotency[key].responseDropped) {
      s.idempotency[key].responseDropped = true
      persist()
      // O pedido foi criado, mas a resposta "se perde" — o cliente deve reenviar com a mesma chave.
      return HttpResponse.error()
    }
    return HttpResponse.json<Order>(publicOrder(order), { status: 201 })
  })),

  http.get('/api/orders', route(({ request }) => {
    const { user } = requireUser(request)
    const status = new URL(request.url).searchParams.get('status')
    const list = db().orders.filter((o) => o.userId === user.id && (!status || o.status === status)).map(publicOrder)
    return HttpResponse.json<Order[]>(list.reverse())
  })),

  http.get('/api/orders/:id', route(({ request, params }) => {
    const { user } = requireUser(request)
    const order = db().orders.find((o) => o.id === params.id)
    if (!order) throw fail(404, 'NOT_FOUND', 'Pedido não encontrado.')
    if (order.userId !== user.id) throw fail(403, 'FORBIDDEN', 'Você não tem acesso a este pedido.')
    return HttpResponse.json<Order>(publicOrder(order))
  })),

  // Carteiras
  http.get('/api/me/wallets', route(({ request }) => {
    const { user } = requireUser(request)
    return HttpResponse.json<Wallet[]>(walletsOf(user.id))
  })),

  http.post('/api/me/wallets', route(async ({ request }) => {
    const { user } = requireUser(request)
    const body = await readJson<UpsertWalletRequest>(request)
    const wallets = walletsOf(user.id)
    validateWallet(body, wallets)
    if (wallets.some((w) => w.role === body.role)) {
      throw fail(409, 'VALIDATION_ERROR', `Você já possui uma carteira ${body.role === 'primary' ? 'principal' : 'secundária'}.`, { fields: { role: 'Já existe uma carteira com esta função.' } })
    }
    const now = new Date().toISOString()
    const wallet: Wallet = { id: nextId('wal'), label: body.label.trim(), provider: body.provider, address: body.address, network: body.network, ensName: body.ensName || null, role: body.role, createdAt: now, updatedAt: now }
    wallets.push(wallet)
    persist()
    return HttpResponse.json<Wallet>(wallet, { status: 201 })
  })),

  http.patch('/api/me/wallets/:id', route(async ({ request, params }) => {
    const { user } = requireUser(request)
    const body = await readJson<UpsertWalletRequest>(request)
    const wallets = walletsOf(user.id)
    const wallet = wallets.find((w) => w.id === params.id)
    if (!wallet) throw fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
    validateWallet(body, wallets, wallet.id)
    // trocar a função promove/rebaixa a outra carteira
    if (body.role !== wallet.role) {
      const other = wallets.find((w) => w.id !== wallet.id && w.role === body.role)
      if (other) other.role = wallet.role
    }
    Object.assign(wallet, { label: body.label.trim(), provider: body.provider, address: body.address, network: body.network, ensName: body.ensName || null, role: body.role, updatedAt: new Date().toISOString() })
    persist()
    return HttpResponse.json<Wallet>(wallet)
  })),

  http.post('/api/me/wallets/:id/connect', route(async ({ request, params }) => {
    const { user } = requireUser(request)
    const { network } = await readJson<ConnectWalletRequest>(request)
    const wallet = walletsOf(user.id).find((w) => w.id === params.id)
    if (!wallet) throw fail(404, 'NOT_FOUND', 'Carteira não encontrada.')
    if (!isNetwork(network)) throw fail(422, 'VALIDATION_ERROR', 'Rede inválida.')
    if (has('wallet-rejected')) throw fail(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira.')
    return HttpResponse.json<WalletConnection>({ walletId: wallet.id, network, connected: true, connectedAt: new Date().toISOString() })
  })),
]

function validateWallet(body: UpsertWalletRequest, wallets: Wallet[], selfId?: string) {
  const fields: Record<string, string> = {}
  if (!body.label || body.label.trim().length < 2) fields.label = 'Informe um nome para a carteira.'
  if (!['metamask', 'coinbase', 'walletconnect'].includes(body.provider)) fields.provider = 'Selecione o provedor.'
  const addrOk = body.network === 'solana' ? SOL_ADDRESS_RE.test(body.address ?? '') : ETH_ADDRESS_RE.test(body.address ?? '')
  if (!body.address || !addrOk) fields.address = body.network === 'solana' ? 'Endereço Solana inválido (base58, 32–44 caracteres).' : 'Endereço inválido (0x + 40 caracteres hexadecimais).'
  else if (wallets.some((w) => w.id !== selfId && w.address.toLowerCase() === body.address.toLowerCase())) fields.address = 'Este endereço já está cadastrado.'
  if (!['primary', 'secondary'].includes(body.role)) fields.role = 'Selecione a função.'
  if (!isNetwork(body.network)) fields.network = 'Selecione uma rede.'
  if (body.ensName && !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.eth$/.test(body.ensName)) fields.ensName = 'Nome ENS inválido (ex.: nome.eth).'
  if (Object.keys(fields).length) throw fail(422, 'VALIDATION_ERROR', 'Verifique os campos destacados.', { fields })
}
