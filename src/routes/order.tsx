import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2, MailOpen, X, XCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { isApiError } from '@/api/client'
import { container, itemRow, itemThumb } from '@/components/layout'
import { ErrorState } from '@/components/states'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { Order } from '@/contracts'
import { NETWORKS } from '@/contracts'
import { clearIdempotencyKey, useOrder } from '@/features/checkout/hooks'
import { formatEth } from '@/lib/money'
import { cn, thumb } from '@/lib/utils'

const PROVIDER: Record<Order['wallet']['provider'], string> = { metamask: 'MetaMask', walletconnect: 'WalletConnect', coinbase: 'Coinbase Wallet' }

/** Recibo em modal sobre a página escurecida (frame "Confirmação de pedido"); Esc ou ✕ voltam ao início. */
function Shell({ children, label }: { children: React.ReactNode; label: string }) {
  const navigate = useNavigate()
  const closeRef = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && void navigate({ to: '/' })
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [navigate])
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 px-4 py-10 backdrop-blur-[2px] md:py-20">
      <section role="dialog" aria-modal="true" aria-label={label} className="relative mx-auto max-w-[578px] rounded-sm border-b-[10px] border-primary bg-surface shadow-2xl" data-testid="order-card">
        <Link ref={closeRef} to="/" className="absolute right-4 top-4 rounded-sm p-1 text-accent hover:bg-white/5" aria-label="Fechar e voltar ao início">
          <X className="size-5" aria-hidden="true" />
        </Link>
        {children}
      </section>
    </div>
  )
}

function Receipt({ order }: { order: Order }) {
  const date = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(order.updatedAt))
  const network = NETWORKS.find((n) => n.value === order.network)?.label ?? order.network
  const shortTx = order.txHash ? `${order.txHash.slice(0, 6)}…${order.txHash.slice(-4)}` : '—'
  return (
    <Shell label="Pedido confirmado">
      <div className="flex flex-col items-center gap-4 px-6 pb-5 pt-6 text-center">
        <MailOpen className="size-20 text-primary" strokeWidth={1.2} aria-hidden="true" />
        <h1 className="text-base font-bold text-muted" data-testid="order-confirmed">Seus NFTs agora estão na sua carteira</h1>
      </div>
      <dl className="grid grid-cols-2 gap-4 border-y border-primary px-6 py-3 text-sm sm:grid-cols-4 sm:divide-x sm:divide-primary">
        <div className="sm:px-2"><dt className="font-bold">ID da transação</dt><dd className="font-mono" title={order.txHash ?? ''} data-testid="tx-hash">{shortTx}</dd></div>
        <div className="sm:px-3"><dt>Data</dt><dd>{date}</dd></div>
        <div className="sm:px-3"><dt>Total</dt><dd>{formatEth(order.summary.totalEth)}</dd></div>
        <div className="sm:px-3"><dt className="font-bold">Carteira</dt><dd>{PROVIDER[order.wallet.provider]}</dd></div>
      </dl>
      <div className="px-6 py-6 md:px-11">
        <h2 className="text-sm font-bold">Detalhes da transação</h2>
        {/* cabeçalho e linhas compartilham colunas e padding: textos alinham com "Edições" e "Subtotal" */}
        <div className="mt-2 grid grid-cols-[1fr_70px_100px] gap-x-4 border-b border-border px-2 pb-2 text-sm font-bold">
          <span>NFTs</span><span className="text-center">Edições</span><span className="text-right">Subtotal</span>
        </div>
        <ul className="flex flex-col gap-3 py-3" data-testid="receipt-lines">
          {order.lines.map((l) => (
            <li key={l.itemId} className={cn(itemRow, 'grid grid-cols-[1fr_70px_100px] bg-surface-2')}>
              <span className="flex min-w-0 items-center gap-4">
                <img src={thumb(l.imageUrl)} alt="" width={66} height={66} className={cn(itemThumb, 'size-[66px]')} />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{l.name}</span>
                  <span className="block text-sm text-muted">Edição {l.editionName} · {formatEth(l.unitPriceEth)}</span>
                </span>
              </span>
              <span className="text-center text-sm">(x {l.quantity})</span>
              <span className="text-right text-lg font-bold text-accent">{formatEth(l.lineTotalEth)}</span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto flex max-w-[330px] flex-col gap-2 border-b border-border pb-3">
          {order.coupon && (
            <div className="flex justify-between"><dt>Desconto ({order.coupon.code})</dt><dd>(-) {formatEth(order.summary.discountEth)}</dd></div>
          )}
          <div className="flex justify-between"><dt>Taxa de rede</dt><dd className="text-lg">{formatEth(order.summary.networkFeeEth)}</dd></div>
          <div className="flex justify-between font-bold"><dt>Total</dt><dd className="text-lg text-accent" data-testid="receipt-total">{formatEth(order.summary.totalEth)}</dd></div>
        </dl>
        <p className="mt-4 text-center text-sm leading-[22px] text-muted">
          Transação confirmada na {network}. A propriedade foi transferida para sua carteira conectada e registrada na rede.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link to="/mercado" className={buttonVariants({ size: 'md', variant: 'outline' })}>Continuar explorando</Link>
          {order.explorerUrl && (
            <a href={order.explorerUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: 'md' })} aria-label="Ver no explorador de blocos (link simulado, abre em nova aba)">
              Ver no Etherscan <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>
    </Shell>
  )
}

export function OrderPage() {
  const { orderId } = useParams({ from: '/private/pedido/$orderId' })
  const order = useOrder(orderId)
  const qc = useQueryClient()
  const status = order.data?.status

  useEffect(() => {
    if (status === 'confirmed' || status === 'declined') {
      clearIdempotencyKey()
      void qc.invalidateQueries({ queryKey: ['cart'] })
      void qc.invalidateQueries({ queryKey: ['private'], predicate: (q) => q.queryKey.includes('pending') })
    }
  }, [status, qc])

  return (
    <div className={container}>
      <div role="status" aria-live="polite" className="sr-only">
        {status === 'pending' && 'Pedido pendente, aguardando confirmação.'}
        {status === 'confirmed' && 'Pedido confirmado.'}
        {status === 'declined' && 'Pagamento recusado.'}
      </div>
      {order.isPending ? (
        <Shell label="Carregando pedido">
          <div className="flex flex-col items-center gap-4 p-10"><Skeleton className="size-20 rounded-full" /><Skeleton className="h-5 w-2/3" /><Skeleton className="h-40 w-full" /></div>
        </Shell>
      ) : order.isError ? (
        <div className="mt-10">
          <ErrorState error={order.error} onRetry={() => order.refetch()} title={isApiError(order.error) && order.error.status === 404 ? 'Pedido não encontrado' : isApiError(order.error) && order.error.status === 403 ? 'Acesso negado' : 'Não foi possível carregar o pedido'} />
        </div>
      ) : status === 'confirmed' ? (
        <Receipt order={order.data!} />
      ) : status === 'declined' ? (
        <Shell label="Pagamento recusado">
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center" data-testid="order-declined">
            <XCircle className="size-16 text-danger" aria-hidden="true" />
            <h1 className="text-xl font-bold">Pagamento recusado</h1>
            <p className="text-sm text-muted">{order.data!.failureReason ?? 'A transação não foi concluída.'}</p>
            <p className="text-sm">Nenhum valor foi cobrado e seus itens continuam no carrinho.</p>
            <Link to="/carrinho" className={buttonVariants({ size: 'md' })}>Voltar ao carrinho</Link>
          </div>
        </Shell>
      ) : (
        <Shell label="Pedido pendente">
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center" data-testid="order-pending">
            <Loader2 className={cn('size-14 animate-spin text-primary')} aria-hidden="true" />
            <h1 className="text-xl font-bold">Aguardando confirmação na rede…</h1>
            <p className="text-sm text-muted">Pedido {order.data!.id} · {formatEth(order.data!.summary.totalEth)}</p>
            <p className="text-sm">Você pode recarregar esta página com segurança: o pedido não será duplicado.</p>
          </div>
        </Shell>
      )}
    </div>
  )
}
