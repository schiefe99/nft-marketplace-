import './index.css'

/**
 * A camada de mocks é ativada por configuração (VITE_ENABLE_MOCKS, padrão "true")
 * e também está presente no build de demonstração.
 *
 * O app é importado somente DEPOIS do MSW iniciar: o engine.io-client captura
 * `globalThis.WebSocket` ao ser avaliado, e o interceptador de WebSocket do MSW
 * precisa estar instalado antes disso para o socket.io-client ser simulado.
 */
const root = document.getElementById('root')!

/** Mensagem exibida quando o navegador não suporta Service Worker (ex.: navegador interno do WhatsApp/Instagram, aba anônima do Firefox). */
function showUnsupported(reason: string) {
  root.innerHTML = `
    <main style="min-height:100dvh;display:grid;place-items:center;padding:24px;background:#140d0a;color:#f5f1eb;font-family:'Roboto Mono',monospace;text-align:center">
      <div style="max-width:420px">
        <p style="font-weight:700;letter-spacing:.1em;margin:0 0 24px">KURIO</p>
        <h1 style="font-size:18px;margin:0 0 12px">Não foi possível iniciar a demonstração</h1>
        <p style="font-size:14px;line-height:22px;color:#cfb28c;margin:0 0 20px">
          Esta demonstração usa dados simulados que dependem de Service Worker, recurso indisponível neste navegador.
          Abra o link no Chrome, Safari, Edge ou Firefox (fora da aba anônima).
        </p>
        <button id="retry" style="height:44px;padding:0 24px;border:0;border-radius:6px;background:#d28a4c;color:#140d0a;font:inherit;font-weight:700;cursor:pointer">Tentar novamente</button>
        <p style="font-size:11px;color:#b39463;margin:20px 0 0">Detalhe técnico: ${reason.replace(/[<>&]/g, '')}</p>
      </div>
    </main>`
  document.getElementById('retry')?.addEventListener('click', () => window.location.reload())
}

async function startMocksSafely() {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker não suportado')
  const { startMocks } = await import('@/mocks/browser')
  // Evita tela em branco infinita se o registro do worker travar
  await Promise.race([
    startMocks(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Tempo esgotado ao iniciar o Service Worker')), 15_000)),
  ])
}

async function bootstrap() {
  if ((import.meta.env.VITE_ENABLE_MOCKS ?? 'true') === 'true') {
    try {
      await startMocksSafely()
    } catch (err) {
      console.error('[mocks] falha ao iniciar', err)
      showUnsupported(err instanceof Error ? err.message : String(err))
      return
    }
  }
  const { mountApp } = await import('./app')
  mountApp(root)
}

void bootstrap()
