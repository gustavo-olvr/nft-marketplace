# NFT Marketplace — Desafio Frontend

Marketplace de NFTs em React e TypeScript com API, autenticação, carteiras, pagamento e tempo real **simulados** (MSW). Roda a partir de um checkout limpo, sem backend nem serviços privados.

- Decisões de arquitetura, política de cache e de sessão, estado do carrinho, reconciliação REST × Socket.IO, limitações e desvios do Figma: [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Transporte Socket.IO e limitações do ambiente de mocks: [`docs/REALTIME.md`](docs/REALTIME.md)
- Regressão visual: [`docs/VISUAL-REGRESSION.md`](docs/VISUAL-REGRESSION.md)

## Stack

| Responsabilidade              | Tecnologia      | Onde participa                                                                      |
| ----------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| Interface                     | React 19        | `src/`                                                                              |
| Linguagem                     | TypeScript      | contratos tipados em `src/contracts`                                                |
| Roteamento                    | TanStack Router | rotas, parâmetros de busca validados, proteção de rotas privadas (`src/router.tsx`) |
| Estado remoto                 | TanStack Query  | consultas, mutations, atualização otimista e cache (`src/features/*/queries.ts`)    |
| Cliente HTTP                  | Axios           | `src/api/client.ts` e módulos em `src/api`                                          |
| Tempo real                    | Socket.IO       | `src/realtime/client.ts`                                                            |
| Estilização                   | Tailwind CSS    | tokens em `src/index.css`                                                           |
| Componentes                   | shadcn/ui       | `src/components/ui` (Button, Input, Label, Sheet, Skeleton)                         |
| Mocking                       | MSW             | `src/mocks` (REST e Socket.IO)                                                      |
| Testes E2E e regressão visual | Playwright      | `e2e/`                                                                              |
| Performance e qualidade       | Lighthouse      | `lighthouse/`                                                                       |

## Setup

Requer Node.js 22.19 ou superior.

```bash
npm install
npx playwright install chromium     # apenas para os testes E2E
npm run dev                         # Vite com MSW ativo (modo "mocks")
```

### Variáveis de ambiente

O modo `mocks` lê `.env.mocks` (já versionado). `.env.example` documenta as mesmas chaves.

| Variável             | Padrão    | Função                                                             |
| -------------------- | --------- | ------------------------------------------------------------------ |
| `VITE_ENABLE_MOCKS`  | `true`    | ativa o MSW (REST e Socket.IO), inclusive no build de demonstração |
| `VITE_MOCK_SCENARIO` | `default` | cenário inicial dos mocks                                          |
| `VITE_API_BASE_URL`  | `/api`    | base das chamadas REST                                             |

## Comandos

| Comando                      | O que faz                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run dev`                | desenvolvimento com mocks                                                                                  |
| `npm run build`              | verificação de tipos e build de demonstração (com mocks)                                                   |
| `npm run preview`            | serve o build em `http://localhost:4173`                                                                   |
| `npm run typecheck`          | `tsc --noEmit`                                                                                             |
| `npm run lint`               | ESLint                                                                                                     |
| `npm run format`             | Prettier                                                                                                   |
| `npm run test:mocks`         | testes dos handlers MSW e do Socket.IO em Node (`smoke`, `smoke:flows`, `smoke:account`, `smoke:realtime`) |
| `npm run test:e2e`           | testes Playwright (Chromium desktop 1440 px e mobile 390 px); inicia build e preview sozinho               |
| `npm run test:e2e:report`    | abre o relatório HTML do Playwright                                                                        |
| `npm run test:visual:update` | gera as imagens-base da regressão visual (primeira execução)                                               |
| `npm run test:visual`        | compara com as imagens-base                                                                                |
| `npm run lighthouse`         | 3 medições por página e perfil, com medianas, LCP, CLS e TBT em `lighthouse/reports/`                      |

## Credenciais fictícias

| Usuário       | E-mail              | Senha       |
| ------------- | ------------------- | ----------- |
| Ada Collector | `ada@jungle.test`   | `Senha@123` |
| Bruno Minter  | `bruno@jungle.test` | `Senha@456` |

Senhas existem somente como hash SHA-256 com salt no estado do mock. Cupons: `WELCOME10` (10%), `EXPIRED20` (expirado); qualquer outro código é inválido.

## Cenários e reset

Selecione um cenário pela URL (`/?scenario=slow`, persistido em `localStorage`), por `VITE_MOCK_SCENARIO` ou pelo console:

```js
window.__mock.scenarios // nome → descrição
window.__mock.setScenario('price-changed', { reset: true })
window.__mock.reset() // restaura integralmente o seed
window.__mock.expireSession() // revoga sessões (401 SESSION_EXPIRED)
window.__mock.realtime.changePrice('nft_2', 'e_2_1', 20)
```

Cada contexto do navegador tem seu próprio estado (persistido em `localStorage`), então cada teste do Playwright começa isolado.

## Como reproduzir os fluxos de falha

| Situação                                     | Como reproduzir                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Carregamento lento e skeletons               | `/?scenario=slow` ou `variable-latency`                                                    |
| Respostas fora de ordem                      | `/?scenario=out-of-order`, digitar na busca                                                |
| Catálogo vazio                               | `/?scenario=empty` ou `/?q=zzzz`                                                           |
| Sem conexão / erro 5xx / 403                 | `offline`, `catalog-error`, `server-error` (POST /orders), `forbidden` (GET /wallets)      |
| Falha de favorito (rollback)                 | `favorite-error`, favoritar um NFT                                                         |
| Falha ao alterar carrinho (rollback)         | `cart-update-error`, aumentar a quantidade                                                 |
| Sessão expirada                              | `window.__mock.expireSession()` ou `session-expired`                                       |
| Conflito de cadastro                         | `register-conflict`, ou cadastrar `ada@jungle.test`                                        |
| Cupom inválido ou expirado                   | `xyz` e `EXPIRED20` no carrinho                                                            |
| Preço alterado / edição esgotada no checkout | `price-changed`, `sold-out`; ou `changePrice` / `setAvailability` com o checkout aberto    |
| Timeout após criar o pedido                  | `order-timeout`, confirmar e aguardar ~10 s, "Confirmar novamente" recupera o mesmo pedido |
| Pagamento recusado / carteira recusada       | `payment-declined`, `wallet-refused`                                                       |
| Evento duplicado ou antigo                   | `window.__mock.realtime.replayLast()` e `sendStaleNft('nft_2')`                            |
| Queda do tempo real com pedido pendente      | confirmar um pedido, `realtime.block(true)`, aguardar, `realtime.block(false)`             |

Lista completa em `src/mocks/scenarios.ts`.

## Contratos REST (prefixo `/api`)

| Recurso        | Operações                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| Sessão e conta | `POST /auth/register`, `POST /auth/login`, `GET /auth/session`, `POST /auth/logout`                                   |
| NFTs           | `GET /nfts?q&category&collection&minPrice&maxPrice&inStock&sort&page&pageSize`, `GET /nfts/featured`, `GET /nfts/:id` |
| Favoritos      | `GET /favorites`, `PUT /favorites/:nftId`, `DELETE /favorites/:nftId`                                                 |
| Carrinho       | `GET /cart`, `POST /cart/items`, `PATCH` e `DELETE /cart/items/:id`, `POST /cart/merge`                               |
| Cotação        | `POST /quotes` (cupom, disponibilidade, desconto, taxa e total)                                                       |
| Pedidos        | `POST /orders` (header `Idempotency-Key`), `GET /orders/:id`                                                          |
| Perfil         | `GET` e `PATCH /profile`, `PUT /profile/avatar`, `POST /profile/password`                                             |
| Carteiras      | `GET` e `POST /wallets`, `PATCH /wallets/:id`, `POST /wallets/:id/connect` e `/disconnect`                            |

Erros seguem `{ error: { code, message, fieldErrors?, details? } }` com os códigos `VALIDATION`, `UNAUTHENTICATED`, `SESSION_EXPIRED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `AVAILABILITY_CONFLICT`, `QUOTE_CHANGED`, `IDEMPOTENCY_CONFLICT`, `COUPON_INVALID`, `COUPON_EXPIRED`, `WALLET_REFUSED` e `TRANSIENT`. Os tipos estão em `src/contracts/index.ts`. Valores em ETH trafegam como **strings decimais** e a aritmética é feita em wei (`src/lib/money.ts`); quantidades são inteiras.

Regras relevantes do mock:

- O pedido exige o `quoteHash` vigente: divergência → `409 QUOTE_CHANGED` com a nova cotação em `details`; falta de estoque → `409 AVAILABILITY_CONFLICT`.
- Mesma `Idempotency-Key` com o mesmo corpo devolve o mesmo pedido; corpo diferente → `409 IDEMPOTENCY_CONFLICT`.
- O pedido nasce `pending` e é liquidado em ~3 s como `confirmed` ou `rejected` (estados terminais). Só na confirmação baixa o estoque e remove do carrinho os itens e quantidades comprados. O recibo é um snapshot imutável.

## Eventos em tempo real

| Evento          | Efeito                                                                 |
| --------------- | ---------------------------------------------------------------------- |
| `nft.updated`   | atualiza preço e disponibilidade no catálogo, no detalhe e no carrinho |
| `order.updated` | atualiza o pedido e mostra confirmação ou recusa                       |

Todo evento tem `eventId`, `resource`, `resourceId`, `version` e `occurredAt`. O cliente descarta duplicatas e eventos antigos e reconcilia com a REST após reconectar. Detalhes em [`docs/REALTIME.md`](docs/REALTIME.md).

## Deploy

O projeto inclui `vercel.json` (reescrita de rotas para a SPA, para acesso direto e refresh funcionarem, e cabeçalhos do service worker). Na Vercel: importe o repositório, framework **Vite**, comando `npm run build`, saída `dist`. O build de demonstração já ativa o MSW, então a aplicação publicada funciona sem backend, inclusive o tempo real.
