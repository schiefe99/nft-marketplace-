# Arquitetura

## Visão geral

```
src/
  contracts/        Tipos compartilhados (transporte ⇄ mocks ⇄ estado ⇄ UI). ETH = string decimal.
  api/              Axios (client.ts), endpoints tipados, QueryClient e query keys (query.ts)
  lib/              money.ts (decimal.js), session-store.ts, utils
  realtime/         Cliente Socket.IO: dedupe, versão, reconciliação, isolamento por sessão
  features/         Hooks e componentes por domínio (auth, catalog, cart, checkout)
  routes/           Telas (TanStack Router, code-based em router.tsx; telas secundárias com code-splitting)
  components/       Layout, campos acessíveis, cards, estados; components/ui = shadcn/ui adaptado
  mocks/            MSW: db.ts (estado + persistência), fixtures, handlers REST, socket.ts, cenários, painel
tests/e2e/          Playwright (fixtures, specs, baselines visuais)
lighthouse/         Configuração, script de mediana, relatórios e RESULTS.md
```

Regra: **componentes, hooks e o cliente Axios não contêm dados fictícios nem caminhos alternativos de negócio.** Toda simulação vive em `src/mocks/` e só é alcançada pela rede (Service Worker do MSW para REST; interceptador de WebSocket do MSW para Socket.IO). O app é importado dinamicamente **depois** de `worker.start()` (`main.tsx`) porque o `engine.io-client` captura `globalThis.WebSocket` ao ser avaliado.

## Contratos REST

Base `/api`. Autenticação por `Authorization: Bearer <token>`. Carrinho de visitante identificado por `X-Guest-Id`. Erros sempre no formato:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "email": "…" }, "details": {} } }
```

| Código | HTTP | Uso |
|---|---|---|
| `VALIDATION_ERROR` | 400/422 | Campos inválidos (`fields`) |
| `INVALID_CREDENTIALS` | 401 | Login inválido |
| `UNAUTHENTICATED` / `SESSION_EXPIRED` | 401 | Sem sessão / sessão expirada |
| `FORBIDDEN` | 403 | Recurso de outro usuário (pedido, carteira) |
| `WALLET_REJECTED` | 403 | Conexão de carteira recusada |
| `NOT_FOUND` | 404 | Recurso inexistente (inclui rotas `/api/*` desconhecidas) |
| `EMAIL_TAKEN` | 409 | Conflito de cadastro |
| `AVAILABILITY_CONFLICT` | 409 | Estoque/edição indisponível (no pedido traz `details.quote`) |
| `QUOTE_STALE` | 409 | Cotação desatualizada (traz `details.quote` nova) |
| `IDEMPOTENCY_CONFLICT` | 409 | Mesma chave com corpo diferente |
| `ORDER_PENDING` | 409 | Já existe pedido pendente (`details.orderId`) |
| `COUPON_INVALID` / `COUPON_EXPIRED` | 422 | Cupom |
| `WRONG_PASSWORD` | 422 | Senha atual incorreta |
| `TRANSIENT_FAILURE` / `INTERNAL_ERROR` | 5xx | Falha transitória |

| Recurso | Método e rota | Corpo / resposta |
|---|---|---|
| Sessão | `POST /auth/register` | `RegisterRequest` → `201 Session` |
| | `POST /auth/login` | `LoginRequest` → `Session` |
| | `GET /auth/session` | → `Session` (401 se expirada) |
| | `POST /auth/logout` | → `204` |
| NFTs | `GET /nfts?tab&q&category[]&collection&network&minPrice&maxPrice&availability&sort&page&pageSize&ids[]` | → `NftPage` (`Paginated<NftSummary>` + `facets` com contagens por coleção e rede) |
| | `GET /nfts/:id` | → `Nft` (404) |
| | `GET /catalog/meta` | → contagens por coleção/rede, faixa de preço, destaques |
| Favoritos | `GET /me/favorites` · `PUT/DELETE /me/favorites/:nftId` | → `{ nftIds }` |
| Carrinho | `GET /cart` · `POST /cart/items` · `PATCH/DELETE /cart/items/:id` | → `Cart` (com `summary` e `issues`) |
| | `POST/DELETE /cart/coupon` · `POST /cart/acknowledge` · `POST /cart/merge` | → `Cart` |
| Cotação | `POST /checkout/quote` `{ network }` | → `Quote` (linhas, cupom, taxas, total, `fingerprint`, `issues`, `expiresAt`) |
| Pedidos | `POST /orders` + `Idempotency-Key` | `CreateOrderRequest` → `201 Order` (mesma chave+corpo → `200` mesmo pedido) |
| | `GET /orders?status` · `GET /orders/:id` | → `Order[]` / `Order` (snapshot imutável) |
| Perfil | `GET/PATCH /me/profile` · `POST /me/password` | `User` / `204` |
| Carteiras | `GET/POST /me/wallets` · `PATCH /me/wallets/:id` · `POST /me/wallets/:id/connect` | `Wallet` / `WalletConnection` |

Tipos completos: `src/contracts/index.ts`.

### Valores monetários
ETH trafega como **string decimal**; todo cálculo usa `decimal.js` (precisão 40, 18 casas). Quantidades são inteiros. O total exibido no checkout/recibo é sempre o da **cotação da API**; o cliente nunca soma preços para decidir o valor de um pedido.

## Eventos Socket.IO

Transporte: `socket.io-client` real (`transports: ['websocket']`, token na query do handshake) → interceptado por `ws.link(<origem>)` do MSW, decodificado por `@mswjs/socket.io-binding`. Envelope:

```ts
{ eventId, type, resource: { type, id }, version, occurredAt, userId?, data }
```

| Evento | Destino | `data` |
|---|---|---|
| `nft.updated` | todas as conexões | `{ nftId, priceEth, totalAvailable, editions[] }` |
| `order.updated` | somente conexões do dono | `{ order }` |

Toda mutação do banco simulado que afeta esses recursos (painel, `updateNft`, liquidação de pedido) atualiza o estado REST **e** emite o evento correspondente.

**Cliente (`src/realtime/realtime.ts`):**
- Deduplicação por `eventId` (janela de 500) e descarte de `version <=` à última aplicada (também comparada com a versão vinda do REST) — nunca regride estado nem reaplica efeitos.
- `nft.updated`: atualiza detalhe e listas no cache; se o NFT está no carrinho, invalida o carrinho (resumo é recalculado pela API) e publica aviso acessível; o checkout pede nova cotação.
- `order.updated`: ignorado se `userId` ≠ usuário da sessão; atualiza o pedido no cache.
- Reconexão: ao reconectar, invalida queries ativas (`nfts`, `cart`, `private/<user>`) — reconciliação REST.
- Ciclo de vida: um socket por sessão; logout/troca de usuário chama `disconnect()` e remove listeners.

**Limitações do transporte simulado:** apenas WebSocket (sem long-polling), namespace único `/` sem rooms (isolamento feito no servidor simulado filtrando conexões por usuário), ping do Engine.IO enviado manualmente a cada 20 s, handshake sintético do binding (`sid: "test"`). A conexão só existe dentro da aba (o “servidor” vive no mesmo contexto da página).

## Sessão

- Token opaco em `localStorage` (`nft-app-session`); a senha nunca é persistida. Na carga, `GET /auth/session` recupera o usuário (`ensureSession`, aguardado pelo `beforeLoad` das rotas privadas).
- Rotas privadas: `/pagamento`, `/pedido/:id`, `/favoritos`, `/conta/*` → redirecionam para `/login?redirect=<href>`.
- 401 em qualquer chamada → `sessionStore.end('expired')`: cache privado removido, socket recriado como anônimo e, se a tela é privada, redireciona para login com `reason=expired`. Após autenticar, volta ao `redirect` (sanitizado contra open redirect). O rascunho do checkout fica em `sessionStorage` e é restaurado.
- Logout/troca de usuário: `removeQueries(['private'])`, remoção do carrinho do usuário anterior, novo socket.

## Carrinho

- Mantido **na API** (persistido pelo banco simulado): visitante por `X-Guest-Id` (UUID em `localStorage`), usuário por token → sobrevive a refresh.
- Login/cadastro chamam `POST /cart/merge`, que soma os itens do visitante ao carrinho do usuário respeitando disponibilidade e limite por pedido.
- Cada item guarda o último preço “visto”; `issues` informa `price_changed`, `sold_out`, `quantity_reduced`, `unavailable`. Finalizar fica bloqueado até o usuário reconhecer (`/cart/acknowledge`) ou ajustar.
- Após pedido confirmado, o servidor remove **apenas as quantidades compradas**; falhas/recusas preservam o carrinho.

## Checkout e pedidos

1. Cotação (`POST /checkout/quote`) por rede; refeita ao trocar rede, ao mudar o carrinho, a cada `nft.updated` relevante e após reconexão.
2. *Confirmar compra* (um passo) valida o formulário, simula a conexão com a carteira cadastrada (pode ser recusada), recota e cria o pedido. Se a nova cotação diferir do `fingerprint` exibido na tela (ou um evento em tempo real alterar preço/disponibilidade), o pedido **não** é enviado: o novo total aparece e a confirmação fica bloqueada até “Aceitar novo valor”. A rede vem pré-selecionada pela carteira escolhida.
3. `POST /orders` com `Idempotency-Key` derivada da tentativa (cotação + carteira + rede + comprador, guardada em `sessionStorage`). Falhas transitórias são reenviadas com a mesma chave (o servidor devolve o mesmo pedido); cliques repetidos são ignorados (`inFlight`). `QUOTE_STALE`/`AVAILABILITY_CONFLICT` trazem a nova cotação e exigem nova confirmação. O servidor também recusa um 2º pedido enquanto houver um pendente (`ORDER_PENDING`).
4. `/pedido/:id` mostra pendente/confirmado/recusado (`order.updated` + polling de segurança de 4 s enquanto pendente). Refresh/reconexão recuperam o estado; confirmado e recusado são terminais. O recibo é o **snapshot** gravado no pedido — mudanças posteriores no catálogo não o alteram. Hash e link de explorador são simulados.

## Estratégia de cache (TanStack Query)

| Dado | Chave | staleTime | Observações |
|---|---|---|---|
| Listagem | `['nfts','list', params]` | 30 s | `keepPreviousData`; `AbortSignal` cancela a anterior; respostas antigas nunca escrevem na chave atual |
| Detalhe | `['nfts','detail', id]` | 30 s | atualizado por `nft.updated` |
| Meta | `['catalog','meta']` | 5 min | |
| Carrinho | `['cart', userId|guestId]` | 10 s | mutations gravam a resposta da API no cache |
| Privados | `['private', userId, …]` | 30 s | favoritos, perfil, carteiras, pedidos — removidos no logout |

Retries: queries repetem só falhas transitórias (rede/timeout/5xx), até 2× com backoff exponencial; mutations não repetem (exceto criação de pedido, com idempotência). Otimismo com rollback: **favoritos**. Invalidações: carteiras após salvar, pedidos/carrinho após `order.updated`, listas após `nft.updated`.

## Acessibilidade

Skip link, `:focus-visible` com contraste, diálogos/drawers Radix (focus trap, Esc, retorno de foco), labels e `aria-describedby`/`aria-invalid` em todos os campos, foco no 1º campo inválido, toasts e regiões `aria-live` para mutations e eventos em tempo real, estados não dependentes de cor (texto “ESGOTADO”, riscado + rótulo “indisponível”), `prefers-reduced-motion` desliga shimmer e transições, sem overflow horizontal em 390/768/1440.

## Decisões de UX e desvios do Figma

- **Assets:** as ilustrações foram recortadas do export do Figma (4 personagens). Para dar variedade ao catálogo de 36 itens, foram geradas variações de matiz dessas mesmas imagens (`public/nfts/*-b|c.webp`). As imagens de NFT são pequenas no Figma (≈250 px) e foram ampliadas para 480 px no detalhe.
- **Tipografia/cores:** Roboto Mono e tokens extraídos das variáveis do Figma (`color/ink`, `surface-card`, `primary`…), servidos localmente. Sem ajustes de contraste necessários.
- **Login/Cadastro:** como no Figma, são diálogos sobre a página inicial (desktop) e tela cheia no mobile. Login social e “Esqueceu a senha?” estão fora do escopo — exibem aviso e não simulam sucesso.
- **Checkout:** o Figma pede vários campos de carteira no formulário. Como a compra deve usar **carteiras cadastradas**, endereço e ENS vêm da carteira selecionada (somente leitura); “Tipo de carteira”, “Nome do perfil” e “Nome ENS .eth” foram consolidados no card de carteira. Código de indicação e observação são opcionais. A antiga etapa de **revisão em diálogo** foi removida para um fluxo mais direto: a própria tela de pagamento já exibe itens, carteira, rede e total, e mudanças de valor continuam exigindo aceite explícito. No mobile (frame “Mobile / Pagamento com carteira”) a tela prioriza carteira, rede e total; os dados do colecionador, já preenchidos pelo perfil, ficam recolhidos e abrem sozinhos se houver erro.
- **Perfil:** o campo “Apelido da carteira” foi substituído por “Bio” (o apelido é editado em Carteiras).
- **Carteiras:** “Código de indicação”, “E-mail” e “Nome do perfil” do frame não foram mantidos no formulário de carteira (duplicavam o perfil).
- **Filtros:** coleções (em ordem alfabética), faixa de preço (slider de dois controles, acessível por teclado, que aplica ao soltar e mantém o botão *Aplicar*), rede e um filtro extra de disponibilidade. As contagens de coleção e rede vêm da própria listagem (`facets` em `GET /nfts`) e consideram os demais filtros ativos. Busca textual no topo do catálogo e no ícone de lupa.
- **Itens fora de escopo** (Criadores, Aprenda, blog, atividade, ofertas, downloads, suporte, newsletter): visíveis para fidelidade, marcados como indisponíveis (`aria-disabled`, “em breve”) sem aparentar sucesso.
- **Confirmação:** renderizada como card (visual do modal do Figma) numa rota própria `/pedido/:id`, para suportar acesso direto e refresh.
- **Moeda:** ponto como separador decimal, como no Figma (“26.846 ETH”).

## Limitações conhecidas

- O “servidor” é o MSW na própria aba: dados são por navegador (persistidos em `localStorage`). As abas sincronizam o banco pelo evento `storage` (uma aba adota o que a outra gravou, sem sobrescrever), mas os eventos de Socket.IO são emitidos só na aba que fez a alteração — as demais veem a mudança na próxima requisição.
- Relógio controlado nos testes via cenários determinísticos (`pending-hold` + `settleOrder`, `expireSessions`) em vez de timers falsos, porque o MSW/Socket.IO dependem de timers reais.
- Avaliações individuais do NFT e páginas editoriais não fazem parte da entrega.
