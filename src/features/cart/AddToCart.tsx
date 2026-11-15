import { useId, useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { Nft } from '@/contracts'
import { formatEth } from '@/lib/money'
import { useAddToCart } from './queries'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function AddToCart({ nft }: { nft: Nft }) {
  const [editionId, setEditionId] = useState(nft.editions[0]!.id)
  const [quantity, setQuantity] = useState(1)
  const add = useAddToCart()
  const qtyId = useId()
  const hintId = useId()

  const edition = nft.editions.find((e) => e.id === editionId) ?? nft.editions[0]!
  const limit = Math.min(edition.available, edition.maxPerOrder)
  const qty = limit > 0 ? Math.min(Math.max(1, quantity), limit) : 0

  const selectEdition = (id: string) => {
    add.reset()
    setEditionId(id)
  }

  const changeQuantity = (value: string) => {
    add.reset()
    const parsed = Number.parseInt(value, 10)
    setQuantity(Number.isNaN(parsed) ? 1 : parsed)
  }

  return (
    <section className="mt-6" aria-labelledby="editions-title">
      <h2 id="editions-title" className="font-semibold">
        Edições
      </h2>

      <fieldset className="mt-2 space-y-1">
        <legend className="sr-only">Escolha a edição</legend>
        {nft.editions.map((e) => (
          <label key={e.id} className="flex items-center gap-2">
            <input
              type="radio"
              name="edition"
              checked={e.id === editionId}
              onChange={() => selectEdition(e.id)}
            />
            <span>
              {e.label}: {formatEth(e.price)} · {e.available > 0 ? `${e.available} disponíveis` : 'Esgotada'}
            </span>
          </label>
        ))}
      </fieldset>

      <div className="mt-4">
        <Label htmlFor={qtyId}>Quantidade</Label>
        <Input
          id={qtyId}
          type="number"
          inputMode="numeric"
          min={limit > 0 ? 1 : 0}
          max={limit}
          step={1}
          value={qty}
          disabled={limit === 0}
          aria-describedby={hintId}
          onChange={(e) => changeQuantity(e.target.value)}
          className="mt-1.5 w-24"
        />
        <p id={hintId} className="text-sm text-muted-foreground">
          {limit === 0 ? 'Edição esgotada.' : `Máximo de ${limit} por pedido.`}
        </p>
      </div>

      <Button
        variant="default"
        className="mt-4"
        type="button"
        disabled={limit === 0 || add.isPending}
        onClick={() => add.mutate({ nftId: nft.id, editionId: edition.id, quantity: qty })}
      >
        {add.isPending ? 'Adicionando…' : 'Adicionar ao carrinho'}
      </Button>

      <div className="mt-2 min-h-6" aria-live="polite">
        {add.isSuccess && (
          <p role="status">
            Adicionado ao carrinho.{' '}
            <Link to="/cart" className="underline">
              Ver carrinho
            </Link>
          </p>
        )}
        {add.isError && <p role="alert">{add.error.message}</p>}
      </div>
    </section>
  )
}
