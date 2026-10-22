/**
 * Cenários de rede e de negócio configuráveis e reproduzíveis.
 * Selecione com `?scenario=nome[,outro]` na URL (persistido), pelo painel "Mocks"
 * ou via `window.__mocks.setScenario()` nos testes.
 */
import { seeded } from './fixtures'

export type ScenarioName =
  | 'default'
  | 'fast'
  | 'slow'
  | 'variable-latency'
  | 'out-of-order'
  | 'offline'
  | 'server-error'
  | 'empty-catalog'
  | 'session-expired'
  | 'payment-declined'
  | 'order-timeout'
  | 'pending-hold'
  | 'favorite-failure'
  | 'wallet-rejected'
  | 'price-change-during-checkout'

export const SCENARIOS: { name: ScenarioName; description: string }[] = [
  { name: 'default', description: 'Latência realista (150–400 ms), pagamento confirmado em ~2 s' },
  { name: 'fast', description: 'Sem latência (usado nos testes)' },
  { name: 'slow', description: 'Toda resposta leva 2,5 s (skeletons)' },
  { name: 'variable-latency', description: 'Latência pseudo-aleatória 100–2000 ms (seed fixa)' },
  { name: 'out-of-order', description: 'Listagens pares levam 1500 ms e as ímpares 100 ms → respostas fora de ordem' },
  { name: 'offline', description: 'Toda chamada /api falha por erro de conexão' },
  { name: 'server-error', description: 'Listagem e detalhe de NFTs retornam HTTP 500' },
  { name: 'empty-catalog', description: 'Catálogo sem resultados' },
  { name: 'session-expired', description: 'Sessões expiram 20 s após o login' },
  { name: 'payment-declined', description: 'Pagamentos são recusados' },
  { name: 'order-timeout', description: 'Pedido é criado, mas a 1ª resposta se perde (timeout)' },
  { name: 'pending-hold', description: 'Pedidos ficam pendentes até liquidação manual' },
  { name: 'favorite-failure', description: 'Incluir/remover favorito retorna HTTP 500' },
  { name: 'wallet-rejected', description: 'A carteira recusa a conexão' },
  { name: 'price-change-during-checkout', description: 'Preço do 1º item sobe 3 s após a cotação' },
]

export interface NetworkConfig {
  scenarios: Set<ScenarioName>
  latency: [number, number]
  settleDelayMs: number
  sessionTtlMs: number
}

const SCENARIO_KEY = 'nft-mock-scenario'

export const config: NetworkConfig = {
  scenarios: new Set(['default']),
  latency: [150, 400],
  settleDelayMs: 2000,
  sessionTtlMs: 60 * 60_000,
}

let rand = seeded(42)
let requestCounter = 0
let listCounter = 0

export function has(name: ScenarioName) {
  return config.scenarios.has(name)
}

export function applyScenarios(names: ScenarioName[]) {
  config.scenarios = new Set(names.length ? names : ['default'])
  config.latency = has('fast') ? [0, 0] : has('slow') ? [2500, 2500] : has('variable-latency') ? [100, 2000] : [150, 400]
  config.settleDelayMs = has('fast') ? 600 : 2000
  config.sessionTtlMs = has('session-expired') ? 20_000 : 60 * 60_000
  rand = seeded(42)
  requestCounter = 0
  listCounter = 0
  try {
    localStorage.setItem(SCENARIO_KEY, [...config.scenarios].join(','))
  } catch {
    /* noop */
  }
}

export function loadScenarioFromEnvironment() {
  const fromUrl = new URLSearchParams(window.location.search).get('scenario')
  let stored: string | null = null
  try {
    stored = localStorage.getItem(SCENARIO_KEY)
  } catch {
    /* noop */
  }
  const raw = fromUrl ?? stored ?? import.meta.env.VITE_MOCK_SCENARIO ?? 'default'
  const valid = new Set(SCENARIOS.map((s) => s.name))
  applyScenarios(raw.split(',').map((s) => s.trim()).filter((s): s is ScenarioName => valid.has(s as ScenarioName)))
}

/** Latência determinística para a próxima requisição. */
export function nextLatency(kind: 'list' | 'other' = 'other') {
  requestCounter += 1
  // listagens pares demoram mais: a 2ª busca chega DEPOIS da 3ª (determinístico)
  if (has('out-of-order') && kind === 'list') return ++listCounter % 2 === 0 ? 1500 : 100
  const [min, max] = config.latency
  if (max === 0) return 0
  return Math.round(min + rand() * (max - min))
}

// ---------- Falhas pontuais programáveis (testes) ----------
export interface InjectedFailure {
  method: string
  path: RegExp
  status: number | 'network'
  times: number
}

export const injected: InjectedFailure[] = []

export function takeInjectedFailure(method: string, pathname: string) {
  const idx = injected.findIndex((f) => (f.method === '*' || f.method === method) && f.path.test(pathname))
  if (idx === -1) return null
  const f = injected[idx]
  f.times -= 1
  if (f.times <= 0) injected.splice(idx, 1)
  return f
}
