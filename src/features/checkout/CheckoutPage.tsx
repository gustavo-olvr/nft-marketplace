import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ApiError } from '@/api/client'
import type { CreateOrderRequest, Network } from '@/contracts'
import { formatEth } from '@/lib/money'
import { Field } from '@/features/auth/Field'
import { useSession } from '@/features/auth/session'
import { EMAIL_RE } from '@/features/auth/validation'
import { useCoupon } from '@/features/cart/coupon'
import { useCart, useQuote } from '@/features/cart/queries'
import { DEFAULT_SEARCH } from '@/features/catalog/search'
import { useConnectWallet, useDisconnectWallet, useWallets } from '@/features/wallets/queries'
import { useCreateOrder } from './queries'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageTitle } from '@/lib/use-page-title'

const NETWORKS: { value: Network; label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'base', label: 'Base' },
]

function orderErrorMessage(error: Error): string {
  if (!(error instanceof ApiError)) return 'Erro inesperado ao enviar o pedido.'
  if (error.code === 'QUOTE_CHANGED')
    return 'Os valores mudaram desde a sua última revisão. Confira o resumo atualizado e confirme novamente.'
  if (error.code === 'AVAILABILITY_CONFLICT')
    return 'Algum item ficou indisponível. Volte ao carrinho para ajustar as quantidades.'
  if (error.kind === 'timeout' || error.kind === 'network') {
    return 'Não recebemos a resposta do servidor e seu pedido pode ter sido criado. Tentar novamente é seguro: o mesmo pedido será recuperado, sem cobrança duplicada.'
  }
  return error.message
}

export function CheckoutPage() {
  usePageTitle('Pagamento')
  const navigate = useNavigate()
  const session = useSession()
  const cart = useCart()
  const wallets = useWallets()
  const connect = useConnectWallet()
  const disconnect = useDisconnectWallet()
  const create = useCreateOrder()
  const [coupon] = useCoupon()
  const [edits, setEdits] = useState<{ name?: string; email?: string; walletId?: string; network?: Network }>(
    {},
  )
  const [submitted, setSubmitted] = useState(false)

  const cartItems = cart.data?.items ?? []
  const items = cartItems.map(({ nftId, editionId, quantity }) => ({ nftId, editionId, quantity }))
  const walletList = wallets.data?.wallets ?? []
  const wallet = walletList.find((w) => w.id === edits.walletId) ?? walletList[0]
  const network = edits.network ?? wallet?.network ?? 'ethereum'
  const name = edits.name ?? session.data?.user.name ?? ''
  const email = edits.email ?? session.data?.user.email ?? ''
  const quote = useQuote(items, coupon, network)

  const errors = {
    name: !name.trim() ? 'Informe seu nome' : undefined,
    email: !EMAIL_RE.test(email) ? 'Informe um e-mail válido' : undefined,
    wallet: !wallet
      ? 'Cadastre uma carteira para continuar'
      : wallet.connection !== 'connected'
        ? 'Conecte a carteira para continuar'
        : undefined,
  }
  const blockingLines = quote.data?.lines.filter((l) => l.status !== 'ok') ?? []
  const walletMutationError = connect.error ?? disconnect.error

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (create.isPending || !quote.data || quote.isPlaceholderData || quote.isFetching || !wallet) return
    if (blockingLines.length > 0 || errors.name || errors.email || errors.wallet) return
    const body: CreateOrderRequest = {
      items,
      coupon,
      network,
      walletId: wallet.id,
      quoteHash: quote.data.hash,
      collector: { name: name.trim(), email: email.trim() },
    }
    create.mutate(body, {
      onSuccess: ({ order }) => navigate({ to: '/orders/$orderId', params: { orderId: order.id } }),
    })
  }

  if (cart.isPending || wallets.isPending) {
    return (
      <main className="p-6" role="status">
        <span className="sr-only">Carregando checkout…</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-40 w-full max-w-xl" />
      </main>
    )
  }

  if (cart.isError || wallets.isError) {
    const error = cart.error ?? wallets.error
    return (
      <main className="p-6" role="alert">
        <p>Não foi possível carregar o checkout: {error?.message}</p>
        <Button
          variant="link"
          size="inline"
          onClick={() => {
            cart.refetch()
            wallets.refetch()
          }}
        >
          Tentar novamente
        </Button>
      </main>
    )
  }

  if (cartItems.length === 0) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Pagamento</h1>
        <p className="mt-2">Seu carrinho está vazio.</p>
        <Link to="/" search={DEFAULT_SEARCH} className="underline">
          Explorar o catálogo
        </Link>
      </main>
    )
  }

  const canSubmit =
    !create.isPending &&
    !!quote.data &&
    !quote.isPlaceholderData &&
    !quote.isFetching &&
    blockingLines.length === 0

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold">Pagamento</h1>

      <form onSubmit={submit} noValidate className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <fieldset className="space-y-4">
            <legend className="font-semibold">Dados do colecionador</legend>
            <Field
              label="Nome"
              autoComplete="name"
              value={name}
              error={submitted ? errors.name : undefined}
              onChange={(e) => setEdits({ ...edits, name: e.target.value })}
            />
            <Field
              label="E-mail"
              type="email"
              autoComplete="email"
              value={email}
              error={submitted ? errors.email : undefined}
              onChange={(e) => setEdits({ ...edits, email: e.target.value })}
            />
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="font-semibold">Carteira</legend>
            {walletList.length === 0 && <p>Você ainda não cadastrou nenhuma carteira.</p>}
            {walletList.map((w) => (
              <div key={w.id} className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="wallet"
                    checked={wallet?.id === w.id}
                    onChange={() => setEdits({ ...edits, walletId: w.id, network: undefined })}
                  />
                  <span>
                    {w.label} · {w.address.slice(0, 6)}…{w.address.slice(-4)} ·{' '}
                    {w.connection === 'connected' ? 'Conectada' : 'Desconectada'}
                  </span>
                </label>
                {w.connection === 'connected' ? (
                  <Button
                    variant="link"
                    size="inline"
                    type="button"
                    disabled={disconnect.isPending}
                    onClick={() => disconnect.mutate(w.id)}
                  >
                    Desconectar<span className="sr-only"> {w.label}</span>
                  </Button>
                ) : (
                  <Button
                    variant="link"
                    size="inline"
                    type="button"
                    disabled={connect.isPending}
                    onClick={() => connect.mutate(w.id)}
                  >
                    {connect.isPending && connect.variables === w.id ? 'Conectando…' : 'Conectar'}
                    <span className="sr-only"> {w.label}</span>
                  </Button>
                )}
              </div>
            ))}
            {walletMutationError && <p role="alert">{walletMutationError.message}</p>}
            {submitted && errors.wallet && <p role="alert">{errors.wallet}</p>}

            <div>
              <label htmlFor="network" className="block text-sm font-medium">
                Rede
              </label>
              <select
                id="network"
                value={network}
                onChange={(e) => setEdits({ ...edits, network: e.target.value as Network })}
                className="border px-2 py-2"
              >
                {NETWORKS.map((n) => (
                  <option key={n.value} value={n.value}>
                    {n.label}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>
        </div>

        <aside aria-label="Revisão do pedido" className="space-y-4">
          <h2 className="font-semibold">Revisão</h2>

          {quote.isPending ? (
            <div role="status" className="space-y-2">
              <span className="sr-only">Calculando valores…</span>
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
          ) : quote.isError ? (
            <div role="alert">
              <p>Não foi possível calcular a cotação: {quote.error.message}</p>
              <Button variant="link" size="inline" type="button" onClick={() => quote.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div aria-busy={quote.isFetching}>
              <ul className="space-y-1">
                {quote.data.lines.map((l) => (
                  <li key={`${l.nftId}-${l.editionId}`} className="flex justify-between gap-2">
                    <span>
                      {l.quantity}× {l.name} ({l.editionLabel})
                    </span>
                    <span>{formatEth(l.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-3 space-y-1">
                <div className="flex justify-between">
                  <dt>Subtotal</dt>
                  <dd>{formatEth(quote.data.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Desconto</dt>
                  <dd>−{formatEth(quote.data.discount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Taxa de rede</dt>
                  <dd>{formatEth(quote.data.networkFee)}</dd>
                </div>
                <div className="flex justify-between border-t pt-2 font-semibold">
                  <dt>Total</dt>
                  <dd>{formatEth(quote.data.total)}</dd>
                </div>
              </dl>
              {blockingLines.length > 0 && (
                <p role="alert" className="mt-3">
                  Há itens que precisam de atenção.{' '}
                  <Link to="/cart" className="underline">
                    Revisar no carrinho
                  </Link>
                </p>
              )}
            </div>
          )}

          {create.isError && <p role="alert">{orderErrorMessage(create.error)}</p>}

          <Button variant="default" className="w-full" type="submit" disabled={!canSubmit}>
            {create.isPending
              ? 'Enviando pedido…'
              : create.isError
                ? 'Confirmar novamente'
                : 'Confirmar pedido'}
          </Button>
        </aside>
      </form>
    </main>
  )
}
