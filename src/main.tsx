import './index.css'

/**
 * A camada de mocks é ativada por configuração (VITE_ENABLE_MOCKS, padrão "true")
 * e também está presente no build de demonstração.
 *
 * O app é importado somente DEPOIS do MSW iniciar: o engine.io-client captura
 * `globalThis.WebSocket` ao ser avaliado, e o interceptador de WebSocket do MSW
 * precisa estar instalado antes disso para o socket.io-client ser simulado.
 */
async function bootstrap() {
  if ((import.meta.env.VITE_ENABLE_MOCKS ?? 'true') === 'true') {
    const { startMocks } = await import('@/mocks/browser')
    await startMocks()
  }
  const { mountApp } = await import('./app')
  mountApp(document.getElementById('root')!)
}

void bootstrap()
