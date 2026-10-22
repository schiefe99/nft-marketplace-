import Decimal from 'decimal.js'
import type { EthAmount } from '@/contracts'

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

/** Escala usada para normalizar valores em ETH (18 casas = wei). */
const ETH_SCALE = 18

export const eth = (value: EthAmount | number | Decimal) => new Decimal(value)

/** Serializa para string decimal sem zeros à direita e sem notação científica. */
export function toEth(value: Decimal): EthAmount {
  const fixed = value.toDecimalPlaces(ETH_SCALE).toFixed()
  return fixed === '-0' ? '0' : fixed
}

export const addEth = (...values: EthAmount[]): EthAmount =>
  toEth(values.reduce((acc, v) => acc.plus(v), new Decimal(0)))

export const mulEth = (value: EthAmount, factor: number | string): EthAmount =>
  toEth(new Decimal(value).times(factor))

export const isValidEth = (value: string) => /^\d+(\.\d{1,18})?$/.test(value.trim())

/** Formata para exibição preservando precisão (até 6 casas, sem arredondar valores menores para zero). */
export function formatEth(value: EthAmount, opts: { symbol?: boolean; maxDecimals?: number } = {}): string {
  const { symbol = true, maxDecimals = 6 } = opts
  const d = new Decimal(value)
  let digits = maxDecimals
  // valores muito pequenos: mostra casas suficientes para não virar 0
  while (!d.isZero() && d.abs().lessThan(new Decimal(10).pow(-digits)) && digits < ETH_SCALE) digits++
  const [int, frac = ''] = d.toDecimalPlaces(digits, Decimal.ROUND_HALF_UP).toFixed().split('.')
  // Notação do Figma: ponto decimal (ex.: "26.846 ETH"); milhares com vírgula
  const intFmt = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const out = frac ? `${intFmt}.${frac}` : intFmt
  return symbol ? `${out} ETH` : out
}

export const compareEth = (a: EthAmount, b: EthAmount) => new Decimal(a).comparedTo(b)
