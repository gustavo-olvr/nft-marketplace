# Arquitetura

SPA em React e TypeScript. O TanStack Router controla rotas e o estado de busca na URL, o TanStack Query controla dados remotos, o Axios centraliza o HTTP e o MSW fornece, na camada de rede, uma API e um servidor Socket.IO simulados e determinísticos.

```text
UI (React, Tailwind, shadcn/ui)
 ├─ TanStack Router  → rotas, search params validados, beforeLoad para rotas privadas
 ├─ TanStack Query   → cache, mutations, otimismo, invalidação
 │    └─ src/api (Axios) ── /api ──────────► MSW: handlers REST + banco simulado
 └─ src/realtime (socket.io-client) ── /realtime ► MSW: ws.link + @mswjs/socket.io-binding
                                                   (mesmo banco: REST e eventos coerentes)
```

## Organização

| Pasta                          | Conteúdo                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `src/contracts`                | tipos dos contratos compartilhados por transporte, estado, UI e mocks                                                |
| `src/api`                      | uma função por operação REST; `client.ts` injeta token e normaliza erros em `ApiError`                               |
| `src/features`                 | telas, hooks de dados e regras por domínio: `catalog`, `cart`, `checkout`, `auth`, `favorites`, `profile`, `wallets` |
| `src/realtime`                 | cliente Socket.IO, deduplicação, ordenação por versão, reconciliação, avisos e status da conexão                     |
| `src/mocks`                    | handlers REST, banco, fixtures, cenários, servidor de eventos e controles (`window.__mock`)                          |
| `src/components/ui`            | componentes shadcn/ui                                                                                                |
| `src/lib`                      | QueryClient, aritmética de ETH, sessão, eventos de sessão, hooks utilitários                                         |
| `e2e`, `scripts`, `lighthouse` | testes Playwright, testes dos mocks em Node e auditoria Lighthouse                                                   |

Componentes, hooks e o cliente Axios não contêm respostas fictícias nem caminhos de negócio alternativos: tudo o que é simulado vive em `src/mocks` e responde na rede.

## Estado e cache

**Política do QueryClient** (`src/lib/query-client.ts`)

| Item                   | Valor                                                                         | Motivo                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `staleTime`            | 30 s                                                                          | evita refetch a cada montagem; a frescura crítica vem de invalidação e eventos                       |
| `retry` de queries     | até 2 vezes, somente para falha de rede, timeout e 5xx (`ApiError.retryable`) | 4xx não melhora ao repetir                                                                           |
| `retry` de mutations   | nunca                                                                         | repetir criação de pedido ou item de carrinho não é seguro; a recuperação do pedido usa idempotência |
| `refetchOnWindowFocus` | desligado                                                                     | a sincronização é feita por eventos e reconciliação                                                  |
| Cotações (`useQuote`)  | `staleTime: 0`                                                                | o total precisa refletir o servidor                                                                  |

**Chaves de consulta** incluem todos os parâmetros que alteram o resultado (`nftKeys.list(params)`, `nftKeys.detail(id)`, `cartKeys.quote(itens, cupom, rede)`), o que isola o cache por consulta. Buscas antigas são canceladas por `AbortSignal` e `keepPreviousData` mantém a lista anterior, esmaecida, durante a troca de filtro. Respostas fora de ordem não sobrescrevem a busca atual porque cada parâmetro tem sua própria entrada de cache.

**Invalidação:** mutations de carrinho gravam a resposta da API no cache e invalidam as cotações; erros 409 de pedido invalidam cotação e carrinho; pedido confirmado invalida carrinho e catálogo.

**Atualização otimista com rollback** em duas interações: quantidade no carrinho (`useUpdateCartItem`) e favoritos (`useToggleFavorite`). `onMutate` cancela consultas, guarda o estado anterior e aplica a mudança; `onError` restaura; `onSettled` invalida.

**Estado de URL:** busca, filtros, ordenação e página são serializados na URL e validados por `parseCatalogSearch` (valores inválidos caem nos padrões). Mudar um filtro reinicia a página. A digitação usa `replace` e debounce de 300 ms para não poluir o histórico; filtros e paginação empilham histórico, então "voltar" e refresh restauram o estado.

## Sessão

- Token em `localStorage` (`jg.token`), enviado como `Authorization: Bearer`. A sessão é recuperada após refresh por `GET /auth/session`. No mock ela vale 1 hora.
- Rotas privadas (`/checkout`, `/orders/:id`, `/profile`, `/wallets`) usam `beforeLoad` e redirecionam ao login com `redirect` na URL. O retorno é validado por `safeRedirect`, que aceita apenas caminhos internos.
- Qualquer `401` com token presente dispara `SESSION_EXPIRED` (`QueryCache` e `MutationCache`): o token é removido, o cache inteiro é limpo e o usuário vai ao login com aviso e retorna à tela onde estava. Isso vale também durante o checkout: o carrinho está no servidor e o pedido é recuperável por idempotência.
- Login e logout executam `queryClient.clear()` e encerram o socket, então dados privados e subscriptions de um usuário não vazam para o seguinte.
- Senhas existem apenas como hash com salt no estado do mock. Não há segredo no frontend.

## Carrinho

O carrinho é um recurso do servidor, por dono: o usuário autenticado ou o visitante (cabeçalho `X-Guest-Id`, gerado no navegador). No login, `POST /cart/merge` mescla os itens do visitante respeitando disponibilidade e limite por pedido. Cada item guarda `unitPriceSeen`; a cotação compara com o preço atual e marca `price_changed`, e a pessoa precisa aceitar o novo preço. Subtotal, desconto, taxa de rede e total vêm da resposta de `POST /quotes`, nunca de cálculo no front. O cupom fica em `sessionStorage` para sobreviver entre carrinho e checkout.

## Checkout e pedidos

1. A cotação traz um `hash` determinístico. O pedido envia `quoteHash`; se algo mudou, a API responde `409 QUOTE_CHANGED` com a nova cotação, e a pessoa precisa confirmar de novo (o botão também fica bloqueado enquanto a cotação é atualizada).
2. A `Idempotency-Key` é derivada do conteúdo do pedido e guardada em `sessionStorage`. Repetir o mesmo conteúdo (clique duplo, timeout, reenvio, refresh) reutiliza a chave e recupera o mesmo pedido; conteúdo diferente gera chave nova.
3. O pedido passa por `pending`, `confirmed` e `rejected`, e os dois últimos são terminais. A confirmação só é exibida para pedido `confirmed`. Em caso de recusa ou falha os itens permanecem no carrinho; na confirmação, só os itens e quantidades comprados saem.
4. O recibo reproduz o snapshot do pedido, imune a mudanças posteriores no catálogo.

## Tempo real e reconciliação REST × Socket.IO

A REST é a fonte da verdade e o socket é uma otimização de latência.

- Cada evento traz `eventId`, `resource`, `resourceId` e `version`. O cliente descarta repetidos por `eventId` e eventos cuja versão não supera a maior versão conhecida (mapa interno e cache). Estados terminais de pedido nunca regridem.
- `nft.updated` atualiza detalhe e listas no cache, invalida as cotações quando o NFT está no carrinho e avisa por região `aria-live`. `order.updated` só chega ao dono do pedido, e o cliente confere a audiência de novo.
- Após reconectar, os recursos ativos (catálogo, detalhe, carrinho, cotações e pedidos) são invalidados e rebuscados na REST. Consultas inativas ficam marcadas como desatualizadas e se atualizam ao serem montadas.
- Com o socket conectado, o pedido pendente não usa polling; sem socket, volta a consultar a REST a cada 2 s. Reabrir ou recarregar a página recupera o pedido pelo id na URL.
- Ao trocar de usuário ou sair, o socket é encerrado, os listeners removidos e um contador de época descarta eventos atrasados.

Transporte e limitações do Socket.IO no MSW: [`docs/REALTIME.md`](docs/REALTIME.md).

## Mocks

- Estado único em `src/mocks/db.ts`, persistido em `localStorage`; REST e eventos saem da mesma fonte, então mudanças aparecem em ambos.
- Cenários determinísticos (`src/mocks/scenarios.ts`): latência fixa ou variável, falhas por regra (`GET /nfts` falha N vezes, `POST /orders` sempre falha), sessão expirada, conflito de cadastro, preço alterado, edição esgotada, timeout com criação do pedido, pagamento e carteira recusados. Latência variável usa gerador pseudoaleatório com semente.
- Fixtures: 48 NFTs com 1 a 3 edições, 5 categorias, 6 coleções, 4 NFTs esgotados e 2 usuários.
- `window.__mock` permite trocar de cenário, resetar, expirar a sessão e disparar eventos pelo servidor simulado. A UI nunca dispara eventos diretamente.

## Interface e acessibilidade

- Layout fluido; filtros do catálogo ficam em linha a partir de 768 px e, abaixo disso, em um drawer (Radix Dialog) com foco preso, retorno do foco ao gatilho e fechamento por `Esc`. O cabeçalho quebra linha em telas estreitas. Há testes de overflow horizontal em 390, 768 e 1440 px, com visitante e com usuário autenticado.
- Skeletons com shimmer em catálogo, detalhe, carrinho, resumo, checkout, perfil, carteiras e pedido, com as mesmas dimensões do conteúdo (testado), e animação desligada com `prefers-reduced-motion`.
- Foco visível global, `label` associado a todo campo, erros ligados por `aria-describedby` e `aria-invalid`, estados com texto (não só cor), `aria-live` para mutations e eventos em tempo real, um `main` e um `h1` por página, título do documento por rota, `alt` descritivo nas imagens.

## Decisões de UX

- Filtros imediatos, sem botão "Aplicar"; "Limpar filtros" sempre disponível, inclusive no resultado vazio.
- Em conflito de preço ou disponibilidade, o app nunca confirma sozinho: explica, atualiza o resumo e exige nova confirmação.
- Itens do carrinho com problema bloqueiam o checkout e levam de volta ao carrinho.
- "Confirmar novamente" após timeout é seguro e é dito explicitamente à pessoa.
- Ações fora do escopo não aparentam sucesso: o link de exploração do recibo é exibido como texto simulado, não como link.

## Testes e medições

- `npm run test:mocks`: 86 verificações em Node dos handlers e do Socket.IO (cliente real contra o MSW).
- `npm run test:e2e`: Playwright em Chromium desktop (1440 px) e mobile (390 px) cobrindo catálogo, detalhe, conta, sessão, favoritos, carrinho, compra completa, falhas, perfil, carteiras, tempo real, acessibilidade, responsividade, skeletons e resiliência. Cada teste começa em contexto isolado; relógio, latência e eventos são controlados por cenários, `page.clock` e `window.__mock`.
- Regressão visual (`@visual`): início, detalhe, carrinho e pagamento; as imagens-base precisam ser geradas e versionadas (`docs/VISUAL-REGRESSION.md`).
- `npm run lighthouse`: início e detalhe, mobile e desktop, 3 medições, mediana, LCP, CLS e TBT, com a configuração em `lighthouse/config.mjs`. A auditoria roda sobre o build de demonstração, com MSW ativo e service worker iniciado a frio, sem simplificações para melhorar a nota.

## Limitações conhecidas e desvios do Figma

- **Figma:** o arquivo do Figma não esteve disponível durante o desenvolvimento. A identidade visual atual é um tema neutro provisório (tokens em `src/index.css`, componentes shadcn/ui em `src/components/ui`), e não reproduz tipografia, cores, espaçamentos e composição do layout. A fidelidade visual ao Figma **não foi atendida**.
- **Imagens:** os NFTs usam placeholders SVG determinísticos gerados em `src/mocks/fixtures.ts`, no lugar dos assets do Figma. Não há avatar padrão com imagem (usa-se a inicial do nome).
- **shadcn/ui:** os componentes foram adicionados manualmente seguindo o código-fonte padrão (variantes com `class-variance-authority`, Radix e `cn`), com `components.json` presente; o CLI pode regenerá-los.
- **Perfil, carteiras e confirmação em mobile** não têm frame no layout de referência e seguem o mesmo padrão visual das demais telas.
- **Mocks:** o estado vive em `localStorage` por navegador; não há sincronização entre abas ou usuários diferentes. O isolamento entre usuários é verificado em `smoke-realtime`, não em E2E.
- **Lighthouse:** os resultados dependem do ambiente de execução e do start a frio do service worker do MSW; as notas devem ser medidas e registradas na máquina de entrega.
- **Produção real:** substituir o MSW por backend HTTPS, autenticação, autorização, persistência e servidor Socket.IO compatíveis; o token em `localStorage` deveria virar cookie `HttpOnly`.
