import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  label: string
  disabled?: boolean
  size?: 'sm' | 'lg'
}

/** Seletor de quantidade (inteiros) com limites e rótulos acessíveis. */
export function QuantityStepper({ value, min = 1, max, onChange, label, disabled, size = 'sm' }: Props) {
  const btn = cn(
    'grid place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40',
    size === 'lg' ? 'h-12 w-8' : 'size-5',
  )
  return (
    <div role="group" aria-label={label} className="flex items-center gap-3">
      <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label={`Diminuir ${label.toLowerCase()}`}>
        <Minus className={size === 'lg' ? 'size-6' : 'size-3'} strokeWidth={3} aria-hidden="true" />
      </button>
      <output aria-live="polite" aria-label={label} className={cn('min-w-4 text-center tabular-nums', size === 'lg' ? 'text-lg' : 'text-base')} data-testid="quantity-value">
        {value}
      </output>
      <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label={`Aumentar ${label.toLowerCase()}`}>
        <Plus className={size === 'lg' ? 'size-6' : 'size-3'} strokeWidth={3} aria-hidden="true" />
      </button>
    </div>
  )
}
