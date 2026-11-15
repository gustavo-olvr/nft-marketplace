import { useState } from 'react'
import type { Wallet } from '@/contracts'
import { WalletForm } from './WalletForm'
import { useWallets } from './queries'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageTitle } from '@/lib/use-page-title'

const KIND_LABEL: Record<Wallet['kind'], string> = { primary: 'Principal', secondary: 'Secundária' }

export function WalletsPage() {
  usePageTitle('Carteiras')
  const { data, isPending, isError, error, refetch } = useWallets()
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  if (isPending) {
    return (
      <main className="p-6" role="status">
        <span className="sr-only">Carregando carteiras…</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-24 w-full max-w-xl" />
      </main>
    )
  }

  if (isError) {
    return (
      <main className="p-6" role="alert">
        <p>Não foi possível carregar as carteiras: {error.message}</p>
        <Button variant="link" size="inline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </main>
    )
  }

  const wallets = data.wallets
  const hasPrimary = wallets.some((w) => w.kind === 'primary')

  return (
    <main className="mx-auto max-w-xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Carteiras</h1>

      {wallets.length === 0 && <p>Você ainda não cadastrou nenhuma carteira.</p>}

      <ul className="space-y-4">
        {wallets.map((w) => (
          <li key={w.id}>
            {editing === w.id ? (
              <WalletForm
                wallet={w}
                defaultKind={w.kind}
                onDone={() => setEditing(null)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <div className="rounded border p-4">
                <p className="font-semibold">
                  {w.label} · {KIND_LABEL[w.kind]}
                </p>
                <p className="break-all font-mono text-sm">{w.address}</p>
                <p className="text-sm text-muted-foreground">
                  Rede: {w.network} · {w.connection === 'connected' ? 'Conectada' : 'Desconectada'}
                </p>
                <Button
                  variant="link"
                  size="inline"
                  className="mt-2"
                  type="button"
                  onClick={() => setEditing(w.id)}
                >
                  Editar<span className="sr-only"> {w.label}</span>
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {editing === 'new' ? (
        <WalletForm
          defaultKind={hasPrimary ? 'secondary' : 'primary'}
          onDone={() => setEditing(null)}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <Button variant="outline" size="sm" type="button" onClick={() => setEditing('new')}>
          Adicionar carteira
        </Button>
      )}
    </main>
  )
}
