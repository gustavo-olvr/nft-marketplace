import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { QuoteLine } from '@/contracts'
import { formatEth } from '@/lib/money'
import { DEFAULT_SEARCH } from '@/features/catalog/search'
import { useCoupon } from './coupon'
import { useCart, useQuote, useRemoveCartItem, useUpdateCartItem } from './queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageTitle } from '@/lib/use-page-title'

const NETWORK = 'ethereum' as const

const LINE_NOTICE: Partial<Record<QuoteLine['status'], (line: QuoteLine) => string>> = {
  price_changed: () => 'O preço mudou desde que você adicionou este item.',
  sold_out: () => 'Esta edição esgotou.',
  insufficient: (line) => `Só há ${line.available} disponíveis.`,
  over_limit: (line) => `Máximo de ${line.maxPerOrder} por pedido.`,
  not_found: () => 'Este item não está mais disponível.',
}

function CartSkeleton() {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">Carregando carrinho…</span>
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex gap-4" aria-hidden="true">
          <Skeleton className="h-16 w-16 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

function SummarySkeleton() {
  return (
    <div role="status" className="space-y-2">
      <span className="sr-only">Calculando valores…</span>
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  )
}

export function CartPage() {
  usePageTitle('Carrinho')
  const cart = useCart()
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const [coupon, setCoupon] = useCoupon()
  const [couponInput, setCouponInput] = useState(coupon ?? '')

  const cartItems = cart.data?.items ?? []
  const quoteItems = cartItems.map(({ nftId, editionId, quantity }) => ({ nftId, editionId, quantity }))
  const quote = useQuote(quoteItems, coupon, NETWORK)
  const mutationError = update.error ?? remove.error

  if (cart.isPending)
    return (
      <main className="p-6">
        <CartSkeleton />
      </main>
    )

  if (cart.isError) {
    return (
      <main className="p-6" role="alert">
        <p>Não foi possível carregar o carrinho: {cart.error.message}</p>
        <Button variant="link" size="inline" onClick={() => cart.refetch()}>
          Tentar novamente
        </Button>
      </main>
    )
  }

  if (cartItems.length === 0) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Carrinho</h1>
        <p className="mt-2">Seu carrinho está vazio.</p>
        <Link to="/" search={DEFAULT_SEARCH} className="underline">
          Explorar o catálogo
        </Link>
      </main>
    )
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Carrinho</h1>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_320px]">
        <section aria-label="Itens do carrinho" aria-busy={quote.isFetching}>
          {quote.isPending ? (
            <CartSkeleton />
          ) : quote.isError ? (
            <div role="alert">
              <p>Não foi possível calcular a cotação: {quote.error.message}</p>
              <Button variant="link" size="inline" onClick={() => quote.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <ul className="space-y-6">
              {quote.data.lines.map((line) => {
                const item = cartItems.find((i) => i.nftId === line.nftId && i.editionId === line.editionId)
                if (!item) return null
                const max = Math.min(line.available, line.maxPerOrder)
                const notice = LINE_NOTICE[line.status]?.(line)
                return (
                  <li key={item.id} className="flex gap-4">
                    <img
                      src={line.imageUrl}
                      alt={`Arte do NFT ${line.name}`}
                      width={64}
                      height={64}
                      className="h-16 w-16 shrink-0 object-cover"
                    />
                    <div className="flex-1">
                      <h2 className="font-semibold">{line.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {line.editionLabel} · {formatEth(line.unitPrice)} cada
                      </p>

                      <div className="mt-2 flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          aria-label={`Diminuir quantidade de ${line.name}`}
                          disabled={item.quantity <= 1 || update.isPending}
                          onClick={() => update.mutate({ id: item.id, quantity: item.quantity - 1 })}
                        >
                          −
                        </Button>
                        <span aria-live="polite" aria-label={`Quantidade: ${item.quantity}`}>
                          {item.quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          aria-label={`Aumentar quantidade de ${line.name}`}
                          disabled={item.quantity >= max || update.isPending}
                          onClick={() => update.mutate({ id: item.id, quantity: item.quantity + 1 })}
                        >
                          +
                        </Button>
                        <Button
                          variant="link"
                          size="inline"
                          className="ml-4"
                          type="button"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(item.id)}
                        >
                          Remover<span className="sr-only"> {line.name}</span>
                        </Button>
                      </div>

                      {notice && (
                        <p role="alert" className="mt-2 text-sm">
                          {notice}{' '}
                          {line.status === 'price_changed' && (
                            <Button
                              variant="link"
                              size="inline"
                              type="button"
                              onClick={() => update.mutate({ id: item.id, unitPriceSeen: line.unitPrice })}
                            >
                              Aceitar novo preço
                            </Button>
                          )}
                        </p>
                      )}
                    </div>
                    <p className="font-medium">{formatEth(line.lineTotal)}</p>
                  </li>
                )
              })}
            </ul>
          )}
          {mutationError && (
            <p role="alert" className="mt-4">
              {mutationError.message}
            </p>
          )}
        </section>

        <aside aria-label="Resumo do pedido" className="space-y-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              setCoupon(couponInput.trim() || undefined)
            }}
          >
            <Label htmlFor="coupon">Cupom</Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                id="coupon"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                autoComplete="off"
              />
              <Button variant="outline" size="sm" type="submit">
                Aplicar
              </Button>
            </div>
            {coupon && (
              <Button
                variant="link"
                size="inline"
                className="mt-1 text-sm"
                type="button"
                onClick={() => {
                  setCoupon(undefined)
                  setCouponInput('')
                }}
              >
                Remover cupom
              </Button>
            )}
            <div aria-live="polite" className="min-h-5 text-sm">
              {quote.data?.coupon.status === 'applied' && (
                <p role="status">Cupom {quote.data.coupon.code} aplicado.</p>
              )}
              {(quote.data?.coupon.status === 'invalid' || quote.data?.coupon.status === 'expired') && (
                <p role="alert">{quote.data.coupon.message}</p>
              )}
            </div>
          </form>

          {quote.isPending ? (
            <SummarySkeleton />
          ) : quote.data ? (
            <dl className="space-y-1" aria-busy={quote.isFetching}>
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd>{formatEth(quote.data.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Desconto</dt>
                <dd>−{formatEth(quote.data.discount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Taxa de rede (estimada)</dt>
                <dd>{formatEth(quote.data.networkFee)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <dt>Total</dt>
                <dd>{formatEth(quote.data.total)}</dd>
              </div>
            </dl>
          ) : null}

          {quote.data?.lines.some((l) => l.status !== 'ok') ? (
            <p role="alert" className="text-sm">
              Resolva os avisos dos itens para finalizar a compra.
            </p>
          ) : (
            <Button asChild className="w-full">
              <Link to="/checkout">Finalizar compra</Link>
            </Button>
          )}
        </aside>
      </div>
    </main>
  )
}
