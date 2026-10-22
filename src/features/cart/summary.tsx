import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { isApiError } from '@/api/client'
import { Skeleton } from '@/components/ui/skeleton'
import type { AppliedCoupon, CartSummary } from '@/contracts'
import { formatEth } from '@/lib/money'
import { cn } from '@/lib/utils'
import { useApplyCoupon, useRemoveCoupon } from './hooks'

export function SummaryLines({ summary, coupon, className }: { summary: CartSummary; coupon: AppliedCoupon | null; className?: string }) {
  return (
    <dl className={cn('flex flex-col gap-3 text-[15px]', className)} data-testid="cart-summary">
      <div className="flex justify-between">
        <dt>Subtotal</dt>
        <dd className="text-lg tabular-nums" data-testid="summary-subtotal">{formatEth(summary.subtotalEth)}</dd>
      </div>
      <div className="flex justify-between">
        <dt>Desconto do lançamento{coupon ? ` (${coupon.code})` : ''}</dt>
        <dd className="tabular-nums" data-testid="summary-discount">(-) {coupon ? formatEth(summary.discountEth) : '00.00'}</dd>
      </div>
      <div className="flex justify-between">
        <dt>Taxa de rede</dt>
        <dd className="text-lg tabular-nums" data-testid="summary-fee">{formatEth(summary.networkFeeEth)}</dd>
      </div>
      <p className="-mt-2 text-right text-xs text-accent">Taxa estimada</p>
      <div className="flex justify-between border-t border-border pt-4 font-bold">
        <dt className="text-base">Total</dt>
        <dd className="text-lg text-accent tabular-nums" data-testid="summary-total">{formatEth(summary.totalEth)}</dd>
      </div>
    </dl>
  )
}

export function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-4" data-testid="summary-skeleton" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex justify-between">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-20" />
        </div>
      ))}
      <Skeleton className="mt-3 h-6 w-full" />
    </div>
  )
}

export function CouponForm({ coupon }: { coupon: AppliedCoupon | null }) {
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return setError('Informe um código promocional.')
    setError(null)
    try {
      await apply.mutateAsync(code.trim())
      setCode('')
    } catch (err) {
      setError(isApiError(err) ? (err.fields.code ?? err.message) : 'Não foi possível aplicar o cupom.')
    }
  }

  if (coupon) {
    return (
      <div className="flex items-center justify-between rounded-sm border border-primary bg-primary/10 px-3 py-2 text-sm" data-testid="applied-coupon">
        <span>
          <strong>{coupon.code}</strong> — {coupon.description}
        </span>
        <button type="button" onClick={() => remove.mutate()} disabled={remove.isPending} className="rounded-sm p-1 hover:bg-white/10" aria-label={`Remover cupom ${coupon.code}`}>
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor="coupon" className="text-sm font-bold">Código promocional</label>
      <div className="flex">
        <input
          id="coupon"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Digite o código promocional..."
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'coupon-error' : undefined}
          className="h-10 min-w-0 flex-1 rounded-l-sm border border-primary bg-transparent px-2 text-xs placeholder:text-muted aria-[invalid=true]:border-danger"
        />
        <button type="submit" disabled={apply.isPending} className="h-10 rounded-r-sm bg-primary px-5 text-sm font-bold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
          {apply.isPending ? '…' : 'Aplicar'}
        </button>
      </div>
      {error && <p id="coupon-error" role="alert" className="text-sm text-danger" data-testid="coupon-error">{error}</p>}
    </form>
  )
}
