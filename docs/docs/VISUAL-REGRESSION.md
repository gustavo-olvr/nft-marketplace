# Regressão visual

Os testes visuais (`e2e/visual.spec.ts`, marcados com `@visual`) capturam **início**, **detalhe do NFT**, **carrinho** e **pagamento** em Chromium desktop (1440 px) e mobile (390 px), com dados determinísticos do cenário `default`: imagens SVG geradas por fixture, mesmo estado inicial em cada contexto e animações desativadas pelo Playwright.

Eles ficam fora de `npm run test:e2e` até existirem imagens-base.

## Primeira execução (gerar as imagens-base)

```bash
npm run test:visual:update
```

Revise as imagens geradas em `e2e/visual.spec.ts-snapshots/` e versione-as:

```bash
git add e2e/visual.spec.ts-snapshots
git commit -m "test: imagens-base da regressão visual"
```

## Comparação

```bash
npm run test:visual
```

Uma diferença visual precisa de inspeção humana: não atualize as imagens-base automaticamente em CI. As imagens-base dependem do sistema operacional, das fontes e da versão do Chromium, então gere e compare no mesmo ambiente.

## Pendência

As imagens-base registram o visual **atual** (tema provisório). Elas não substituem a comparação com o Figma, que depende do arquivo de referência.
