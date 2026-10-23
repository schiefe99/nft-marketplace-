# Kurio — Marketplace de NFTs

Implementação do desafio front-end **Marketplace de NFTs** a partir do Figma *“Marketplace de NFTs GreenMint”* (marca **Kurio**).
Fluxos de descoberta, compra e conta do colecionador, desktop e mobile, com APIs, autenticação, carteiras, pagamentos e tempo real **simulados na camada de rede (MSW)**.

| Responsabilidade | Tecnologia |
|---|---|
| Interface / Linguagem | React 19 + TypeScript (strict) |
| Roteamento | TanStack Router (rotas tipadas, search params validados, guarda de rotas privadas) |
| Estado remoto | TanStack Query (queries, mutations, cache, otimismo, cancelamento) |
| HTTP | Axios (interceptors de auth, guest id e normalização de erros) |
| Tempo real | `socket.io-client` + MSW `ws.link` + `@mswjs/socket.io-binding` |
| Estilo / Componentes | Tailwind CSS v4 + shadcn/ui (Radix: Dialog/Sheet, Checkbox, Label, Slot) adaptados à identidade do Figma |
| Mocking | MSW 2 (REST + WebSocket), cenários configuráveis e reproduzíveis |
| E2E / Visual | Playwright (Chromium desktop 1440 px e mobile 390 px) |
| Auditoria | Lighthouse CI (3 medições por página/perfil, mediana) |

---

## Setup

Requisitos: **Node ≥ 20** e npm.

```bash
npm ci
npm run dev          # http://localhost:5173 (mocks ativos)
```

Não há backend: todas as chamadas `/api/*` e o Socket.IO são atendidos pelo MSW no navegador.

### Comandos

| Comando | Descrição |
|---|---|
| `npm run dev` / `npm run dev:mocks` | Desenvolvimento com mocks (ativos por padrão; para desligar, `VITE_ENABLE_MOCKS=false` no `.env`) |
| `npm run build` | Verificação de tipos + build otimizado (`dist/`) — **inclui os mocks** (build de demonstração) |
| `npm run preview` | Serve o build em http://localhost:4173 |
| `npm run typecheck` | `tsc -b` |
| `npm run lint` | oxlint |
| `npm run test:e2e` | Playwright (builda, sobe o preview e roda desktop + mobile) |
| `npm run test:e2e:update` | Regera as baselines visuais |
| `npm run test:e2e:report` | Abre o relatório HTML (`playwright-report/`) |
| `npm run lighthouse` | Build + Lighthouse CI mobile/desktop → `lighthouse/reports/**` e `lighthouse/RESULTS.md` |

> Primeira execução dos testes: `npx playwright install chromium`. Para usar um Chromium já instalado: `PW_CHROMIUM_PATH=/caminho/chromium npm run test:e2e` (Lighthouse: `CHROME_PATH=...`).

### Variáveis de ambiente (`.env.example`)

| Variável | Padrão | Uso |
|---|---|---|
| `VITE_ENABLE_MOCKS` | `true` | Liga a camada MSW (também no build publicado) |
| `VITE_MOCK_SCENARIO` | `default` | Cenário inicial |
| `VITE_API_URL` | `/api` | Base REST usada pelo Axios |
| `VITE_API_TIMEOUT_MS` | `10000` | Timeout do Axios |
| `VITE_SOCKET_URL` | origem da página | Servidor Socket.IO |

---

## Credenciais fictícias

| Usuário | E-mail | Senha | Observações |
|---|---|---|---|
| Ana Colecionadora | `ana@nft.test` | `Senha@123` | 1 carteira (principal), 2 favoritos |
| Bruno Trader | `bruno@nft.test` | `Senha@123` | 2 carteiras (principal + secundária), 1 favorito |

Senhas são armazenadas apenas como hash SHA-256 com salt no “banco” simulado; o cliente persiste somente o token de sessão.

**Cupons:** `KURIO10` (10%), `GENESIS25` (25%), `EXPIRADO20` (expirado), qualquer outro → inválido.

**NFTs esgotados:** `nft-011`, `nft-013` e `nft-026` têm todas as edições esgotadas — aparecem no filtro *Disponibilidade → Esgotados* e não permitem compra.

## Catálogo e filtros

- Todo o estado (busca, coleções, faixa de preço, rede, disponibilidade, aba, ordenação e página) fica na URL: sobrevive a refresh, link direto e voltar/avançar.
- **Faixa de preço:** ao soltar o controle (mouse, toque ou setas do teclado) a lista já recarrega com a faixa escolhida; o botão *Aplicar* continua disponível.
- **Contagens:** o número ao lado de cada coleção e rede considera os demais filtros ativos (a própria faceta é ignorada), então “Polygon (5)” mostra exatamente 5 resultados ao ser clicado.

---

## Cenários de mock

Selecione de três formas (combináveis, separados por vírgula):

1. **URL:** `/?scenario=slow` ou `/?scenario=fast,payment-declined` (fica salvo até o reset)
2. **Painel “Mocks”** (botão no canto inferior esquerdo; aparece ao abrir qualquer página com `?mocks` na URL e fica ativo na aba)
3. **Console / testes:** `window.__mocks.setScenario(['order-timeout'])`

| Cenário | Efeito |
|---|---|
| `default` | Latência 150–400 ms (seed fixa), pagamento confirmado em ~2 s |
| `fast` | Sem latência (testes) |
| `slow` | Toda resposta leva 2,5 s (skeletons) |
| `variable-latency` | 100–2000 ms pseudo-aleatório (seed fixa) |
| `out-of-order` | Listagens pares 1500 ms, ímpares 100 ms → respostas fora de ordem |
| `offline` | Toda chamada `/api` falha por erro de conexão |
| `server-error` | Listagem/detalhe de NFTs → HTTP 500 |
| `empty-catalog` | Catálogo vazio |
| `session-expired` | Sessões expiram 20 s após o login |
| `payment-declined` | Pagamentos recusados |
| `order-timeout` | Pedido é criado mas a 1ª resposta se perde → recuperação por idempotência |
| `pending-hold` | Pedido fica pendente até liquidação manual |
| `favorite-failure` | Incluir/remover favorito → HTTP 500 (rollback otimista) |
| `wallet-rejected` | Carteira recusa a conexão |
| `price-change-during-checkout` | 3 s após a cotação, o preço do 1º item sobe 10% (evento `nft.updated`) |

**Reset:** painel “Mocks” → *Restaurar dados e cenário*, ou `await window.__mocks.reset()`. Restaura integralmente fixtures, sessões, carrinhos, pedidos e falhas injetadas.

### API de controle (`window.__mocks`)

`setScenario(names)`, `reset(names?)`, `failNext(method, pathRegex, status|'network', times)`, `updateNft(nftId, { editionId?, priceEth?, priceFactor?, available? })` (muta o banco **e** emite `nft.updated`), `settleOrder(orderId, 'confirmed'|'declined')`, `replayEvent(eventId)`, `eventHistory()`, `dropSockets()`, `expireSessions()`, `state()`.

---

## Reproduzindo os fluxos de falha

| Fluxo | Passos |
|---|---|
| Skeleton + erro + retry | `/mercado?scenario=slow` → skeletons; troque para `server-error` no painel e navegue → “Tentar novamente” após voltar para `default` |
| Respostas fora de ordem | `?scenario=out-of-order`, digite rapidamente duas buscas — prevalece a última |
| Sessão expirada | Entre, abra `/conta/perfil`, rode `window.__mocks.expireSessions()` e navegue → login com aviso e retorno ao ponto de origem (no checkout o rascunho do formulário é preservado) |
| Favorito com falha | `?scenario=favorite-failure` → favoritar mostra o estado otimista, faz rollback e avisa |
| Cupom inválido/expirado | `NAOEXISTE` / `EXPIRADO20` no carrinho |
| Preço alterado no carrinho/checkout | Com itens no carrinho, painel → *Subir preço do 1º item* (ou `?scenario=price-change-during-checkout`) → aviso, resumo atualizado e confirmação bloqueada até aceitar o novo valor |
| Edição esgotada durante a compra | Painel → *Esgotar 1º item do carrinho* |
| Timeout com idempotência | `?scenario=order-timeout` → a 1ª resposta se perde, o cliente reenvia com a mesma `Idempotency-Key` e recupera o **mesmo** pedido |
| Pagamento recusado | `?scenario=payment-declined` |
| Desconexão com pedido pendente | `?scenario=pending-hold`, confirme a compra, painel → *Derrubar conexão* e/ou recarregue; depois `window.__mocks.settleOrder('<id>', 'confirmed')` |
| Carteira recusa | `?scenario=wallet-rejected` |

---

## Testes

`npm run test:e2e` — 30+ cenários em `tests/e2e/` (desktop Chromium; os marcados com `@mobile` também rodam em 390 px):

- `catalog.spec.ts` — busca, filtros combinados, ordenação, paginação, histórico/refresh, vazio, skeleton, falha/retry, fora de ordem
- `nft-detail.spec.ts` — acesso direto, inexistente, 404, edição indisponível/esgotada, limite de quantidade, favorito com falha + rollback + persistência
- `auth.spec.ts` — cadastro (validação/conflito), login inválido, retorno ao fluxo, logout, expiração, troca de usuário sem vazamento
- `cart.spec.ts` — quantidades, remoção, cupons, refresh, merge do carrinho do visitante no login, alteração de preço via Socket.IO
- `checkout.spec.ts` — compra completa até o recibo, recusa, duplo clique, timeout + idempotência, preço alterado via Socket.IO, carteira recusada
- `realtime.spec.ts` — eventos duplicados/antigos, desconexão + reload com pedido pendente
- `account.spec.ts` — perfil, avatar, senha e carteiras com erros de validação/API
- `a11y.spec.ts` — teclado, skip link, foco visível, focus trap/retorno em diálogos, erros associados, overflow em 390/768/1440
- `visual.spec.ts` — regressão visual de início, detalhe, carrinho e pagamento (baselines versionadas em `tests/e2e/__screenshots__`)

Cada teste usa um contexto novo (estado isolado), cenário `fast` e fixtures determinísticas. Eventos em tempo real são disparados pelo **servidor Socket.IO simulado** e chegam pelo `socket.io-client`; chamadas REST passam pelos handlers MSW. Relatório HTML em `playwright-report/`; traces apenas de falhas (`trace: retain-on-failure`).

---

## Deploy (Vercel)

1. Suba o repositório no GitHub.
2. Em vercel.com → *Add New Project* → importe o repositório (framework Vite detectado).
3. Build `npm run build`, output `dist` (já em `vercel.json`, que também faz o rewrite SPA para acesso direto/refresh de qualquer rota e serve o `mockServiceWorker.js` sem cache).

Netlify/Cloudflare Pages: `public/_redirects` já contém o fallback SPA.

Documentação técnica (contratos, eventos, sessão, carrinho, cache, reconciliação, limitações e desvios do Figma): **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)**. Resultados de performance: **[lighthouse/RESULTS.md](./lighthouse/RESULTS.md)**.
