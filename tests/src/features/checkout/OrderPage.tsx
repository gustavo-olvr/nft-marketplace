import { useEffect } from 'react'
import { getRouteApi, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/client'
import { formatEth } from '@/lib/money'
import { clearStoredCoupon } from '@/features/cart/coupon'
import { cartKeys } from '@/features/cart/keys'
import { nftKeys } from '@/features/catalog/keys'
import { DEFAULT_SEARCH } from '@/features/catalog/search'
import { clearIdempotencyKey } from './idempotency'
import { useOrder } from './queries'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageTitle } from '@/lib/use-page-title'

const route = getRouteApi('/orders/$orderId')

export function OrderPage() {
  usePageTitle('Pedido')
  const { orderId } = route.useParams()
  const qc = useQueryClient()
  const { data, isPending, isError, error, refetch } = useOrder(orderId)
  const order = data?.order
  const status = order?.status

  useEffect(() => {
    if (status !== 'confirmed' && status !== 'rejected') return
    clearIdempotencyKey()
    clearStoredCoupon()
    if (status === 'confirmed') {
      qc.invalidateQueries({ queryKey: cartKeys.all })
      qc.invalidateQueries({ queryKey: nftKeys.all })
    }
  }, [status, qc])

  if (isPending) {
    return (
      <main className="p-6" role="status">
        <span className="sr-only">Carregando pedido…</span>
        <Skeleton className="h-8 w-64" />
        <Skeleton className="mt-4 h-40 w-full max-w-xl" />
      </main>
    )
  }

  if (isError) {
    const apiError = error instanceof ApiError ? error : undefined
    if (apiError?.status === 404 || apiError?.status === 403) {
      return (
        <main className="p-6">
          <h1 className="text-xl font-bold">Pedido não encontrado</h1>
          <p>Este pedido não existe ou você não tem permissão para vê-lo.</p>
          <Link to="/" search={DEFAULT_SEARCH} className="underline">
            Voltar ao catálogo
          </Link>
        </main>
      )
    }
    return (
      <main className="p-6" role="alert">
        <p>Não foi possível carregar o pedido: {error.message}</p>
        <Button variant="link" size="inline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </main>
    )
  }

  if (order!.status === 'pending') {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Aguardando confirmação</h1>
        <p role="status" className="mt-2">
          Estamos confirmando o seu pagamento. Pedido {order!.id}.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Você pode recarregar esta página: o pedido será recuperado e nenhuma nova compra é criada.
        </p>
      </main>
    )
  }

  const snapshot = order!.snapshot

  if (order!.status === 'rejected') {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Pagamento recusado</h1>
        <p role="alert" className="mt-2">
          {order!.rejectionReason ?? 'O pagamento não foi aprovado.'}
        </p>
        <p className="mt-1">Seus itens continuam no carrinho.</p>
        <Link to="/cart" className="underline">
          Voltar ao carrinho
        </Link>
      </main>
    )
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Pedido confirmado</h1>
      <p role="status" className="mt-2">
        Pedido {order!.id} confirmado em {new Date(order!.updatedAt).toLocaleString('pt-BR')}.
      </p>

      <section aria-label="Transação" className="mt-4 space-y-1">
        <p>Rede: {snapshot.network}</p>
        <p>Carteira: {snapshot.walletAddress}</p>
        <p>
          Transação: <span className="break-all font-mono">{order!.txHash}</span>
        </p>
        <p>
          Link de exploração (simulado): <span className="break-all">{order!.explorerUrl}</span>
        </p>
      </section>

      <section aria-label="Itens do pedido" className="mt-6">
        <h2 className="font-semibold">Itens</h2>
        <ul className="mt-2 space-y-1">
          {snapshot.lines.map((l) => (
            <li key={`${l.nftId}-${l.editionId}`} className="flex justify-between gap-2">
              <span>
                {l.quantity}× {l.name} ({l.editionLabel}) · {formatEth(l.unitPrice)} cada
              </span>
              <span>{formatEth(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 max-w-sm space-y-1">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd>{formatEth(snapshot.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Desconto</dt>
            <dd>−{formatEth(snapshot.discount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Taxa de rede</dt>
            <dd>{formatEth(snapshot.networkFee)}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 font-semibold">
            <dt>Total</dt>
            <dd>{formatEth(snapshot.total)}</dd>
          </div>
        </dl>
      </section>

      <Link to="/" search={DEFAULT_SEARCH} className="mt-6 inline-block underline">
        Continuar explorando
      </Link>
    </main>
  )
}
