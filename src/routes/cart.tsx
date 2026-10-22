import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { AlertTriangle, ArrowLeft, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { isApiError } from '@/api/client'
import { Breadcrumb, container } from '@/components/layout'
import { NftCard, NftCardSkeleton } from '@/components/nft-card'
import { QuantityStepper } from '@/components/quantity'
import { EmptyState, ErrorState } from '@/components/states'
import { Button, buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { CartItem } from '@/contracts'
import { useAcknowledgeCart, useCart, useRemoveCartItem, useUpdateCartItem } from '@/features/cart/hooks'
import { CouponForm, SummaryLines, SummarySkeleton } from '@/features/cart/summary'
import { useNftList } from '@/features/catalog/hooks'
import { formatEth } from '@/lib/money'
import { useSession } from '@/lib/session-store'
import { cn, thumb } from '@/lib/utils'

function CartRow({ item }: { item: CartItem }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const max = Math.max(1, Math.min(item.available, item.maxPerOrder))
  const unavailable = item.status !== 'available'
  const changeQty = (quantity: number) =>
    update.mutate({ itemId: item.id, quantity }, { onError: (err) => toast.error(isApiError(err) ? err.message : 'Não foi possível alterar a quantidade.') })

  return (
    <li className="grid grid-cols-[70px_1fr_auto] items-center gap-x-4 gap-y-2 rounded-sm bg-surface md:grid-cols-[70px_1.5fr_0.9fr_0.9fr_0.9fr_40px]" data-testid="cart-row">
      <img src={thumb(item.imageUrl)} alt="" width={70} height={70} className="row-span-3 size-[70px] object-cover md:row-span-1" />
      <div className="min-w-0 py-2 md:py-0">
        <p className="truncate font-bold">
          <Link to="/nft/$nftId" params={{ nftId: item.nftId }} className="hover:text-accent">{item.name}</Link>
        </p>
        <p className="text-sm text-muted">Edição: {item.editionName}</p>
        {unavailable && <p className="text-xs font-bold text-warning">{item.status === 'sold_out' ? 'Esgotado' : 'Indisponível'}</p>}
      </div>
      <div className="col-start-2 md:col-start-auto">
        <p className="font-bold text-accent md:font-normal md:text-muted">
          <span className="sr-only">Preço unitário: </span>
          {formatEth(item.unitPriceEth)}
        </p>
        {item.previousUnitPriceEth && (
          <p className="text-xs text-warning" data-testid="price-changed">
            <span className="sr-only">Preço anterior: </span>
            <s>{formatEth(item.previousUnitPriceEth)}</s> → preço atualizado
          </p>
        )}
      </div>
      <div className="col-start-3 row-start-1 row-span-2 self-center pr-3 md:col-start-auto md:row-start-auto md:row-span-1 md:pr-0">
        <QuantityStepper value={item.quantity} max={max} onChange={changeQty} label={`Quantidade de ${item.name}`} disabled={update.isPending || unavailable} />
      </div>
      <p className="hidden font-bold text-accent md:block">
        <span className="sr-only">Total do item: </span>
        {formatEth(item.lineTotalEth)}
      </p>
      <button
        type="button"
        onClick={() => remove.mutate({ itemId: item.id, name: item.name })}
        disabled={remove.isPending}
        className="col-start-3 row-start-3 justify-self-end p-2 pr-3 text-muted hover:text-danger md:col-start-auto md:row-start-auto md:justify-self-center md:pr-2"
        aria-label={`Remover ${item.name} do carrinho`}
      >
        <Trash2 className="size-5" aria-hidden="true" />
      </button>
    </li>
  )
}

export function CartPage() {
  const cart = useCart()
  const ack = useAcknowledgeCart()
  const navigate = useNavigate()
  const router = useRouter()
  const { user } = useSession()
  const data = cart.data
  const hasBlocking = Boolean(data?.issues.some((i) => i.type !== 'price_changed'))
  const priceChanged = Boolean(data?.issues.some((i) => i.type === 'price_changed'))
  const empty = data && data.items.length === 0

  const checkout = () => {
    if (!user) return void navigate({ to: '/login', search: { redirect: '/pagamento' } })
    void navigate({ to: '/pagamento' })
  }

  return (
    <div className={container}>
      <div className="mt-4 flex items-center gap-3 md:hidden">
        <button type="button" onClick={() => router.history.back()} className="grid size-9 place-items-center rounded-full bg-surface" aria-label="Voltar">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-8 hidden md:block">
        <Breadcrumb items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/mercado' }, { label: 'Carrinho' }]} />
      </div>
      <h1 className="mt-2 text-center text-lg font-bold md:sr-only">Carrinho de NFTs</h1>

      {cart.isError && !data ? (
        <div className="mt-8"><ErrorState error={cart.error} onRetry={() => cart.refetch()} title="Não foi possível carregar o carrinho" /></div>
      ) : empty ? (
        <div className="mt-8">
          <EmptyState title="Seu carrinho está vazio" description="Explore o mercado e adicione NFTs para continuar." action={<Link to="/mercado" className={buttonVariants({ size: 'md' })}>Explorar o mercado</Link>} />
        </div>
      ) : (
        <div className="mt-6 grid gap-12 lg:grid-cols-[1fr_332px] lg:gap-20">
          <section aria-labelledby="cart-items-title">
            <h2 id="cart-items-title" className="sr-only">Itens do carrinho</h2>
            {(priceChanged || hasBlocking) && (
              <div role="alert" className="mb-4 flex flex-col gap-3 rounded-sm border border-warning/60 bg-warning/10 p-4 text-sm" data-testid="cart-issues">
                <p className="flex items-center gap-2 font-bold text-warning">
                  <AlertTriangle className="size-4" aria-hidden="true" /> Alguns itens foram atualizados enquanto você navegava
                </p>
                <ul className="list-disc pl-5">
                  {data?.issues.map((i) => <li key={`${i.itemId}-${i.type}`}>{i.message}</li>)}
                </ul>
                {priceChanged && (
                  <Button size="sm" variant="outline" className="w-fit" onClick={() => ack.mutate()} disabled={ack.isPending}>
                    Entendi, usar novos preços
                  </Button>
                )}
              </div>
            )}
            <div className="hidden grid-cols-[70px_1.5fr_0.9fr_0.9fr_0.9fr_40px] gap-4 border-b border-border pb-3 text-[15px] font-bold md:grid">
              <span className="col-span-2">NFTs</span>
              <span>Preço</span>
              <span>Edições</span>
              <span>Total</span>
              <span className="sr-only">Ações</span>
            </div>
            <ul className="mt-3 flex flex-col gap-3" aria-busy={cart.isFetching}>
              {cart.isPending
                ? Array.from({ length: 3 }, (_, i) => <li key={i}><Skeleton className="h-[70px] w-full rounded-sm" /></li>)
                : data?.items.map((item) => <CartRow key={item.id} item={item} />)}
            </ul>
          </section>

          <aside aria-labelledby="summary-title" className="flex flex-col gap-6">
            <h2 id="summary-title" className="hidden border-b border-border pb-3 text-lg font-bold md:block">Resumo da carteira</h2>
            {data ? <CouponForm coupon={data.coupon} /> : <Skeleton className="h-16 w-full" />}
            <div aria-live="polite">{cart.isPending || !data ? <SummarySkeleton /> : <SummaryLines summary={data.summary} coupon={data.coupon} className={cn(cart.isFetching && 'opacity-70')} />}</div>
            <Button size="md" className="w-full rounded-full md:rounded-sm" onClick={checkout} disabled={!data || data.items.length === 0 || hasBlocking || priceChanged} data-testid="go-checkout">
              Conectar e finalizar
            </Button>
            {(hasBlocking || priceChanged) && <p className="-mt-3 text-center text-xs text-warning">Revise as alterações acima para continuar.</p>}
            <Link to="/mercado" className="-mt-2 text-center text-[15px] text-accent hover:underline">Continuar explorando</Link>
          </aside>
        </div>
      )}
      <AlsoViewed />
    </div>
  )
}

function AlsoViewed() {
  const list = useNftList(useMemo(() => ({ pageSize: 5, page: 1, tab: 'trending' as const }), []))
  return (
    <section className="mt-20 hidden md:block" aria-labelledby="also-title">
      <h2 id="also-title" className="border-b border-border pb-3 text-base font-bold text-accent">Colecionadores também viram</h2>
      <ul className="mt-8 grid grid-cols-5 gap-6">
        {list.isPending ? Array.from({ length: 5 }, (_, i) => <li key={i}><NftCardSkeleton /></li>) : list.data?.items.map((n) => <li key={n.id}><NftCard nft={n} compact /></li>)}
      </ul>
    </section>
  )
}
