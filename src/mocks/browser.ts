import { http } from 'msw'
import { setupWorker } from 'msw/browser'
import { db, initDb, persist, resetDb } from './db'
import { authHandlers } from './handlers/auth'
import { catalogHandlers } from './handlers/catalog'
import { clearOrderTimers, commerceHandlers, rearmScenarioTriggers, resumePendingOrders, settleOrder, updateNft } from './handlers/commerce'
import { apiError } from './http-utils'
import { applyScenarios, config, injected, loadScenarioFromEnvironment, SCENARIOS, type ScenarioName } from './scenarios'
import { connectionCount, dropAllConnections, eventHistory, replayEvent, socketHandlers } from './socket'

const fallback = http.all('/api/*', () => apiError(404, 'NOT_FOUND', 'Rota da API inexistente.'))

export const handlers = [...authHandlers, ...catalogHandlers, ...commerceHandlers, ...socketHandlers, fallback]

/** API de controle dos mocks — usada pelo painel de demonstração e pelos testes Playwright. */
export const mockControls = {
  scenarios: SCENARIOS,
  getScenarios: () => [...config.scenarios],
  setScenario(names: ScenarioName | ScenarioName[]) {
    applyScenarios(Array.isArray(names) ? names : [names])
    rearmScenarioTriggers()
  },
  /** Restaura integralmente o cenário conhecido (dados + falhas injetadas). */
  async reset(names: ScenarioName[] = ['default']) {
    clearOrderTimers()
    injected.splice(0)
    await resetDb()
    applyScenarios(names)
    rearmScenarioTriggers()
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('nft-app')) localStorage.removeItem(k)
    } catch {
      /* noop */
    }
  },
  failNext(method: string, path: string, status: number | 'network' = 500, times = 1) {
    injected.push({ method: method.toUpperCase(), path: new RegExp(path), status, times })
  },
  updateNft,
  settleOrder,
  replayEvent,
  eventHistory,
  dropSockets: dropAllConnections,
  connectionCount,
  expireSessions() {
    db().sessions.forEach((s) => (s.expiresAt = Date.now() - 1))
    persist()
  },
  state: () => db(),
}

declare global {
  interface Window {
    __mocks?: typeof mockControls
    __mocksReady?: boolean
  }
}

export async function startMocks() {
  loadScenarioFromEnvironment()
  await initDb()
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  })
  resumePendingOrders()
  window.__mocks = mockControls
  window.__mocksReady = true
  return worker
}

