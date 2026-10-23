import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronDown, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { isApiError } from '@/api/client'
import { Field, focusFirstInvalid, FormError } from '@/components/field'
import { BackButton, Breadcrumb, container, itemRow, itemThumb, WalletChips } from '@/components/layout'
import { EmptyState, ErrorState } from '@/components/states'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input, InputWithSuffix, NativeSelect, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { BuyerInfo, Network, Quote, Wallet } from '@/contracts'
import { NETWORKS } from '@/contracts'
import { useCart } from '@/features/cart/hooks'
import { CouponForm, SummaryLines, SummarySkeleton } from '@/features/cart/summary'
import { staleQuoteFrom, useConnectWallet, useCreateOrder, usePendingOrders, useQuote, useWallets } from '@/features/checkout/hooks'
import { formatEth } from '@/lib/money'
import { useSession } from '@/lib/session-store'
import { useIsMobile } from '@/lib/use-media'
import { realtime } from '@/realtime/realtime'
import { cn, shortAddress, thumb } from '@/lib/utils'

const DRAFT_KEY = 'nft-app-checkout-draft'
const FORM_ID = 'checkout-form'
const PROVIDER_LABEL: Record<Wallet['provider'], string> = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' }
const ROLE_LABEL: Record<Wallet['role'], string> = { primary: 'Principal', secondary: 'Secundária' }
const networkLabel =(n: Network) => NETWORKS.find((x) => x.value === n)?.label ?? n

interface Draft {
  buyer: BuyerInfo
  network: Network
  walletId: string | null
}

function loadDraft(): Partial<Draft> {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}') as Partial<Draft>
  } catch {
    return {}
  }
}

function QuoteLines({ quote }: { quote: Quote }) {
  return (
    <ul className="flex flex-col gap-3" data-testid="quote-lines">
      {quote.lines.map((l) => (
        <li key={l.itemId} className={cn(itemRow, 'grid grid-cols-[56px_1fr_auto_auto] bg-surface pr-4 md:grid-cols-[66px_1fr_auto_auto]')}>
          <img src={thumb(l.imageUrl)} alt="" width={66} height={66} className={cn(itemThumb, 'size-14 md:size-[66px]')} />
          <div className="min-w-0">
            <p className="truncate font-bold">{l.name}</p>
            <p className="text-sm text-muted">Edição: {l.editionName}</p>
          </div>
          <span className="text-sm">(x {l.quantity})</span>
          <span className="font-bold text-accent md:text-lg">{formatEth(l.lineTotalEth)}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Pagamento em um passo (frames "Pagamento" e "Mobile / Pagamento com carteira"):
 * "Confirmar compra" valida, conecta a carteira, recota e cria o pedido.
 * Se a cotação mudou desde o que está na tela, o pedido NÃO é enviado — o
 * novo total aparece e precisa ser aceito antes de confirmar.
 */
export function CheckoutPage() {
  const { user } = useSession()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isMobile = useIsMobile()
  const cart = useCart()
  const wallets = useWallets()
  const pending = usePendingOrders()
  const quoteMutation = useQuote()
  const connect = useConnectWallet()
  const createOrder = useCreateOrder()
  const formRef = useRef<HTMLFormElement>(null)

  const draft = useRef(loadDraft()).current
  const [buyer, setBuyer] = useState<BuyerInfo>(
    draft.buyer ?? { fullName: user?.name ?? '', username: user?.username ?? '', email: user?.email ?? '', referralCode: '', note: '' },
  )
  const [network, setNetwork] = useState<Network | ''>(draft.network ?? '')
  const [walletId, setWalletId] = useState<string | null>(draft.walletId ?? null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [quote, setQuote] = useState<Quote | null>(null)
  // total exibido antes de uma mudança de cotação ainda não aceita pelo comprador
  const [previousTotal, setPreviousTotal] = useState<string | null>(null)
  const [showCoupon, setShowCoupon] = useState(false)
  const [buyerOpen, setBuyerOpen] = useState(false)

  // Rascunho persistido: sobrevive a expiração de sessão/refresh
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ buyer, network, walletId }))
    } catch {
      /* noop */
    }
  }, [buyer, network, walletId])

  // Carteira padrão: a principal, já com a rede dela (menos passos para comprar)
  useEffect(() => {
    if (walletId || !wallets.data?.length) return
    const primary = wallets.data.find((w) => w.role === 'primary') ?? wallets.data[0]
    setWalletId(primary.id)
    setNetwork((n) => n || primary.network)
  }, [wallets.data, walletId])

  const selectedWallet = wallets.data?.find((w) => w.id === walletId) ?? null
  const effectiveNetwork: Network = network || selectedWallet?.network || 'ethereum'

  /** `silent`: recotação pedida pelo próprio comprador (rede, carrinho) — não exige aceite. */
  const requote = useCallback(
    async (net: Network, { silent = false } = {}) => {
      try {
        const q = await quoteMutation.mutateAsync(net)
        setQuote((prev) => {
          if (!silent && prev && prev.fingerprint !== q.fingerprint) setPreviousTotal((p) => p ?? prev.summary.totalEth)
          return q
        })
        return q
      } catch (err) {
        if (!isApiError(err) || err.status !== 401) toast.error(isApiError(err) ? err.message : 'Não foi possível calcular a cotação.')
        return null
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  // Cotação inicial e a cada troca de rede / mudança no carrinho
  const cartVersion = cart.data?.version
  const cartHasItems = Boolean(cart.data?.items.length)
  useEffect(() => {
    if (cartHasItems) void requote(effectiveNetwork, { silent: true })
  }, [effectiveNetwork, cartVersion, requote, cartHasItems])

  // Tempo real: preço/disponibilidade mudou durante o pagamento → novo total precisa ser aceito
  useEffect(
    () =>
      realtime.on((e) => {
        if (e.type === 'nft.changed' && quote?.lines.some((l) => l.nftId === e.nftId)) void requote(effectiveNetwork)
        if (e.type === 'reconciled') void requote(effectiveNetwork)
      }),
    [quote, effectiveNetwork, requote],
  )

  const quoteChanged = Boolean(quote && previousTotal)
  const blockingIssues = quote?.issues ?? []
  const hasPending = Boolean(pending.data?.length)
  const busy = connect.isPending || createOrder.isPending

  const validate = () => {
    const next: Record<string, string> = {}
    if (buyer.fullName.trim().length < 3) next.fullName = 'Informe o nome de exibição (mínimo 3 caracteres).'
    if (buyer.username.trim().length < 3) next.username = 'Informe o nome de usuário.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer.email.trim())) next.email = 'Informe um e-mail válido.'
    if (!network) next.network = 'Selecione uma rede.'
    if (!walletId) next.walletId = 'Selecione uma carteira cadastrada.'
    if (buyer.referralCode && !/^[A-Z0-9-]{4,16}$/i.test(buyer.referralCode)) next.referralCode = 'Use 4–16 letras, números ou hífen.'
    if ((buyer.note ?? '').length > 280) next.note = 'Máximo de 280 caracteres.'
    return next
  }

  const showErrors = (next: Record<string, string>) => {
    setErrors(next)
    if (Object.keys(next).some((k) => k !== 'walletId' && k !== 'network')) setBuyerOpen(true)
    focusFirstInvalid(formRef.current)
  }

  const placeOrder = async (e?: FormEvent) => {
    e?.preventDefault()
    if (busy || !quote || quoteChanged || blockingIssues.length || hasPending) return
    const next = validate()
    setFormError(null)
    if (Object.keys(next).length) return showErrors(next)
    setErrors({})
    // Conecta a carteira selecionada (o usuário pode recusar na carteira)
    try {
      await connect.mutateAsync({ walletId: walletId!, network: network as Network })
    } catch (err) {
      setFormError(isApiError(err) && err.code === 'WALLET_REJECTED' ? 'A carteira recusou a conexão. Aprove a solicitação na carteira e tente novamente.' : isApiError(err) ? err.message : 'Falha ao conectar a carteira.')
      return
    }
    // Recota antes de assinar: se algo mudou desde a tela, o comprador decide
    const fresh = await requote(network as Network)
    if (!fresh || fresh.fingerprint !== quote.fingerprint || fresh.issues.length) return
    try {
      const order = await createOrder.submit({
        quoteId: fresh.id,
        quoteFingerprint: fresh.fingerprint,
        walletId: walletId!,
        network: network as Network,
        buyer: { ...buyer, fullName: buyer.fullName.trim(), email: buyer.email.trim() },
      })
      if (!order) return
      sessionStorage.removeItem(DRAFT_KEY)
      void qc.invalidateQueries({ queryKey: ['private', user!.id, 'orders'] })
      void navigate({ to: '/pedido/$orderId', params: { orderId: order.id } })
    } catch (err) {
      const stale = staleQuoteFrom(err)
      if (stale) {
        setPreviousTotal(fresh.summary.totalEth)
        setQuote(stale)
        return
      }
      if (isApiError(err) && err.code === 'ORDER_PENDING') {
        const orderId = (err.details as { orderId?: string })?.orderId
        void pending.refetch()
        if (orderId) void navigate({ to: '/pedido/$orderId', params: { orderId } })
        return
      }
      if (isApiError(err) && err.status === 422) showErrors(err.fields)
      toast.error(isApiError(err) ? err.message : 'Não foi possível enviar o pedido.', {
        description: isApiError(err) && err.isTransient ? 'Seus itens foram preservados. Tente novamente — o mesmo pedido será recuperado, sem cobrança duplicada.' : undefined,
      })
    }
  }

  const set = (k: keyof BuyerInfo) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setBuyer((b) => ({ ...b, [k]: e.target.value }))
  const pickWallet = (w: Wallet) => {
    setWalletId(w.id)
    setNetwork(w.network)
  }

  if (cart.data && cart.data.items.length === 0) {
    return (
      <div className={cn(container, 'mt-10')}>
        <EmptyState title="Seu carrinho está vazio" description="Adicione NFTs ao carrinho para finalizar uma compra." action={<Link to="/mercado" className={buttonVariants({ size: 'md' })}>Explorar o mercado</Link>} />
      </div>
    )
  }
  if (wallets.isError) return <div className={cn(container, 'mt-10')}><ErrorState error={wallets.error} onRetry={() => wallets.refetch()} /></div>

  const noWallets = wallets.data && wallets.data.length === 0

  // ── blocos compartilhados entre os layouts desktop e mobile ──
  const buyerFields = (
    <>
      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <Field label="Nome de exibição *" error={errors.fullName}>
          {(p) => <Input {...p} autoComplete="name" value={buyer.fullName} onChange={set('fullName')} />}
        </Field>
        <Field label="Nome de usuário *" error={errors.username}>
          {(p) => <Input {...p} autoComplete="username" value={buyer.username} onChange={set('username')} />}
        </Field>
        {!isMobile && (
          <Field label="Rede *" error={errors.network}>
            {(p) => (
              <NativeSelect {...p} value={network} onChange={(e) => setNetwork(e.target.value as Network)}>
                <option value="">Selecione uma rede</option>
                {NETWORKS.map((n) => <option key={n.value} value={n.value}>{n.label} — taxa {formatEth(n.feeEth)}</option>)}
              </NativeSelect>
            )}
          </Field>
        )}
        <Field label="E-mail *" error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" value={buyer.email} onChange={set('email')} />}
        </Field>
        {!isMobile && (
          <>
            <Field label="Endereço da carteira" hint="Preenchido a partir da carteira selecionada.">
              {(p) => <Input {...p} readOnly value={selectedWallet?.address ?? ''} placeholder="Endereço 0x da carteira" />}
            </Field>
            <Field label="Nome ENS">
              {(p) => <InputWithSuffix {...p} suffix=".eth" readOnly value={(selectedWallet?.ensName ?? '').replace(/\.eth$/, '')} placeholder="Sem nome ENS" />}
            </Field>
          </>
        )}
        <Field label="Código de indicação (opcional)" error={errors.referralCode}>
          {(p) => <Input {...p} value={buyer.referralCode ?? ''} onChange={set('referralCode')} />}
        </Field>
      </div>
      <Field label="Observação do colecionador (opcional)" error={errors.note} className="md:max-w-[350px]">
        {(p) => <Textarea {...p} rows={isMobile ? 3 : 5} value={buyer.note ?? ''} onChange={set('note')} className="md:min-h-[150px]" />}
      </Field>
    </>
  )

  const walletList = wallets.isPending ? (
    <Skeleton className="h-16 w-full" />
  ) : noWallets ? (
    <div className="rounded-sm border border-border p-4 text-sm">
      Você ainda não cadastrou carteiras. <Link to="/conta/carteiras" className="text-accent underline">Cadastrar carteira</Link>
    </div>
  ) : (
    wallets.data?.map((w) => (
      <label
        key={w.id}
        className={cn(
          'flex cursor-pointer items-center gap-4 rounded-sm border border-border bg-surface/40 p-4 transition-colors hover:border-border-soft has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
          walletId === w.id && 'border-foreground hover:border-foreground',
        )}
      >
        <input type="radio" name="wallet" value={w.id} checked={walletId === w.id} onChange={() => pickWallet(w)} className="size-4 accent-[var(--color-primary)]" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="font-bold">
            {w.label}
            {w.label !== ROLE_LABEL[w.role] && <span className="font-normal text-muted"> · {ROLE_LABEL[w.role]}</span>}
          </span>
          <span className="truncate text-sm text-accent">{PROVIDER_LABEL[w.provider]} · {w.ensName ?? shortAddress(w.address)}</span>
          <span className="text-sm text-muted">Rede {w.role === 'primary' ? 'principal ' : ''}{networkLabel(w.network)}</span>
        </span>
      </label>
    ))
  )

  const summary = (
    <>
      {blockingIssues.length > 0 && (
        <div role="alert" className="rounded-sm border border-danger/60 bg-danger/10 p-3 text-sm text-danger" data-testid="quote-issues">
          {blockingIssues.map((i) => <p key={i.itemId + i.type}>{i.message}</p>)}
          <Link to="/carrinho" className="mt-2 inline-block underline">Ajustar no carrinho</Link>
        </div>
      )}
      {showCoupon && cart.data ? (
        <CouponForm coupon={cart.data.coupon} />
      ) : (
        <button type="button" className="text-center text-sm hover:text-accent" onClick={() => setShowCoupon(true)}>
          Tem um código promocional? <span className="underline">Aplique aqui</span>
        </button>
      )}
      <div aria-live="polite">
        {quote ? <SummaryLines summary={quote.summary} coupon={quote.coupon} className={cn(quoteMutation.isPending && 'opacity-60')} /> : <SummarySkeleton />}
      </div>
    </>
  )

  const quoteAlert = quoteChanged && quote && (
    <div role="alert" className="flex flex-col gap-3 rounded-sm border border-warning/60 bg-warning/10 p-4 text-sm" data-testid="quote-changed">
      <p className="flex items-center gap-2 font-bold text-warning"><AlertTriangle className="size-4" aria-hidden="true" /> O valor do pedido mudou</p>
      <p>
        Preço, disponibilidade ou taxas foram atualizados — total de <s>{formatEth(previousTotal!)}</s> para <strong>{formatEth(quote.summary.totalEth)}</strong>. Aceite o novo valor para continuar.
      </p>
      <Button size="sm" variant="outline" className="w-fit" onClick={() => setPreviousTotal(null)}>Aceitar novo valor</Button>
    </div>
  )

  const confirmButton = (
    <Button
      type="submit"
      form={FORM_ID}
      size="md"
      className="h-[45px] w-full text-base max-md:rounded-full"
      disabled={!quote || busy || noWallets || hasPending || quoteChanged || blockingIssues.length > 0}
      data-testid="confirm-order"
    >
      {connect.isPending ? (
        <><Loader2 className="animate-spin" aria-hidden="true" /> Conectando carteira…</>
      ) : createOrder.isPending ? (
        <><Loader2 className="animate-spin" aria-hidden="true" /> Enviando pedido…</>
      ) : (
        'Confirmar compra'
      )}
    </Button>
  )

  return (
    <div className={cn(container, 'max-md:pb-36')}>
      <div className="mt-4 flex items-center gap-3 md:hidden">
        <BackButton fallback="/carrinho" />
        <h1 className="text-lg font-bold">Pagamento com carteira</h1>
      </div>
      <div className="mt-8 hidden md:block">
        <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: 'Pagamento' }]} />
        <h1 className="sr-only">Pagamento</h1>
      </div>

      {hasPending && (
        <div role="status" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-warning/60 bg-warning/10 p-4 text-sm" data-testid="pending-order-banner">
          <span>Você tem um pedido aguardando confirmação. Para evitar compras duplicadas, acompanhe-o antes de criar outro.</span>
          <Link to="/pedido/$orderId" params={{ orderId: pending.data![0].id }} className={buttonVariants({ size: 'sm' })}>Ver pedido pendente</Link>
        </div>
      )}

      {isMobile ? (
        <form id={FORM_ID} ref={formRef} onSubmit={placeOrder} noValidate className="mt-6 flex flex-col gap-7" aria-label="Pagamento com carteira">
          <FormError message={formError} />
          <section aria-labelledby="wallet-title" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 id="wallet-title" className="font-bold">Carteira conectada</h2>
              <Link to="/conta/carteiras" className="text-sm text-accent">Trocar carteira</Link>
            </div>
            {errors.walletId && <p role="alert" className="text-sm text-danger">{errors.walletId}</p>}
            {walletList}
          </section>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-4 font-bold">Rede</legend>
            {errors.network && <p role="alert" className="text-sm text-danger">{errors.network}</p>}
            {NETWORKS.map((n) => (
              <label key={n.value} className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-sm bg-surface px-4 py-3 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring', network === n.value && 'ring-1 ring-primary')}>
                <span className="flex items-center gap-3">
                  <span aria-hidden="true" className="grid size-7 place-items-center rounded-full bg-surface-2 text-xs font-bold text-accent">{n.label[0]}</span>
                  {n.label}
                </span>
                <span className="flex items-center gap-3 text-xs text-muted">
                  taxa {formatEth(n.feeEth)}
                  <input type="radio" name="network" value={n.value} checked={network === n.value} onChange={() => setNetwork(n.value)} className="size-4 accent-[var(--color-primary)]" />
                </span>
              </label>
            ))}
          </fieldset>

          <section aria-labelledby="your-nfts" className="flex flex-col gap-4">
            <h2 id="your-nfts" className="font-bold">Seus NFTs</h2>
            {quote ? <QuoteLines quote={quote} /> : <div className="flex flex-col gap-3">{[0, 1].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>}
            {summary}
          </section>

          {/* Dados já vêm do perfil: ficam recolhidos e abrem sozinhos se houver erro */}
          <details open={buyerOpen} onToggle={(e) => setBuyerOpen(e.currentTarget.open)} className="group rounded-sm bg-surface">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
              <span className="min-w-0">
                <span className="block font-bold">Dados do colecionador</span>
                <span className="block truncate text-sm text-muted">{buyer.fullName || 'Preencha seus dados'} · {buyer.email}</span>
              </span>
              <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="flex flex-col gap-5 px-4 pb-5">{buyerFields}</div>
          </details>

          {quoteAlert}

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(0,0,0,0.35)]">
            <p className="mb-3 flex items-center justify-between font-bold">
              Total: <span className="text-lg text-accent">{quote ? formatEth(quote.summary.totalEth) : '—'}</span>
            </p>
            {confirmButton}
          </div>
        </form>
      ) : (
        <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_405px] lg:gap-8">
          <form id={FORM_ID} ref={formRef} onSubmit={placeOrder} noValidate aria-labelledby="buyer-title" className="flex flex-col gap-6">
            <h2 id="buyer-title" className="text-lg font-bold">Perfil do colecionador</h2>
            <FormError message={formError} />
            {buyerFields}
          </form>

          <aside aria-labelledby="your-nfts" className="flex flex-col gap-5">
            <h2 id="your-nfts" className="text-lg font-bold">Seus NFTs</h2>
            <div className="flex justify-between border-b border-border px-2 pb-2 font-bold"><span>NFTs</span><span>Subtotal</span></div>
            {quote ? <QuoteLines quote={quote} /> : <div className="flex flex-col gap-3">{[0, 1].map((i) => <Skeleton key={i} className="h-[74px] w-full" />)}</div>}
            {summary}

            <fieldset className="flex flex-col gap-3">
              <legend className="mb-4 text-center text-lg font-bold">Carteira e rede</legend>
              {errors.walletId && <p role="alert" className="text-sm text-danger">{errors.walletId}</p>}
              {walletList}
              <WalletChips className="self-center" />
            </fieldset>

            {quoteAlert}
            {confirmButton}
          </aside>
        </div>
      )}
    </div>
  )
}
