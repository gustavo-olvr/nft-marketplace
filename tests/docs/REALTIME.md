# Tempo real (Socket.IO + MSW)

## Transporte

- Cliente: `socket.io-client` real, em `src/realtime/client.ts`, apenas com transporte `websocket`.
- Servidor simulado: `@mswjs/socket.io-binding` sobre `ws.link` do MSW, em `src/mocks/socket.ts`.
- Caminho: `/realtime/` (constante `REALTIME_PATH` em `src/config.ts`).
- Autenticação: o token da sessão vai em `auth` no pacote CONNECT. Sem token, a conexão é anônima e recebe só `nft.updated`.

## Eventos

| Evento          | Destino                                               | Payload                               |
| --------------- | ----------------------------------------------------- | ------------------------------------- |
| `nft.updated`   | todos os clientes autenticados ou anônimos conectados | `RealtimeEvent<Nft>`                  |
| `order.updated` | somente as conexões do dono do pedido                 | `RealtimeEvent<Order>` com `audience` |

Todo evento carrega `eventId` estável, `resource`, `resourceId`, `version` e `occurredAt`.

## Regras do cliente

- Duplicatas são descartadas por `eventId` (janela de 500 ids).
- Eventos antigos são descartados quando `version` não supera a maior versão conhecida (mapa interno e cache do TanStack Query).
- `order.updated` com `audience` diferente do usuário da sessão é ignorado.
- Após reconexão, os recursos ativos (catálogo, detalhe, carrinho, cotações e pedidos) são invalidados e rebuscados na REST.
- Ao trocar de usuário ou sair, o socket é encerrado, os listeners são removidos e o contador de época descarta eventos atrasados.
- Com o socket conectado, o pedido pendente não usa polling; sem socket, volta a consultar a REST a cada 2 s.

## Limitações do ambiente de mocks

1. O binding não implementa long-polling. O cliente precisa usar `transports: ['websocket']`.
2. O MSW remove o prefixo `/socket.io/` da URL antes de casar o handler. Por isso o caminho padrão não pode ser usado com `ws.link('*/socket.io/')`, e usar `ws.link('*')` interceptaria também o WebSocket do HMR do Vite. O projeto usa o caminho próprio `/realtime/`.
3. O binding responde ao handshake do Engine.IO e ao CONNECT por conta própria. O servidor simulado lê o `auth` no pacote CONNECT bruto e envia `44` (erro de conexão) ou `41` (desconexão) como pacotes brutos.
4. O binding não envia pings do Engine.IO. O mock envia `2` a cada 20 s; sem isso o cliente encerra por ping timeout.
5. O binding não oferece salas nem broadcast. O roteamento por usuário é feito na lista de clientes do próprio mock.
6. Um fechamento limpo antes do handshake deixa o cliente aguardando o timeout. Para simular queda do servidor, o mock repassa a conexão ao servidor real inexistente, o que gera o erro de conexão e as tentativas de reconexão.
7. `socket.io-client` guarda a referência de `WebSocket` ao ser carregado. Por isso ele é importado de forma tardia, depois de o MSW iniciar.
8. Em Node (testes), `socket.io-client` usa o pacote `ws`, que o MSW não intercepta. Os testes de integração usam o build de navegador (`dist/socket.io.js`).

## Controles para demonstração e testes

Disponíveis em `window.__mock.realtime`:

- `changePrice(nftId, editionId, percent)` e `setAvailability(nftId, editionId, quantity)`: alteram o estado simulado e disparam `nft.updated`.
- `replayLast()`: reenvia o último evento (duplicata).
- `sendStaleNft(nftId)`: envia um `nft.updated` com versão antiga.
- `dropConnections()`: derruba as conexões (o cliente reconecta).
- `block(true | false)`: simula servidor indisponível até liberar.
- `connections()`: número de conexões abertas.
- `window.__mock.expireSession()`: revoga as sessões e desconecta os sockets.

## Teste de integração

`npm run smoke:realtime` executa o `socket.io-client` real contra os handlers do MSW e verifica atualização de catálogo, detalhe e carrinho, duplicatas, eventos antigos, isolamento entre usuários, queda e reconciliação com pedido pendente, liberação de listeners e expiração de sessão.
