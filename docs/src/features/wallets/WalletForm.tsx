import { useState, type FormEvent } from 'react'
import { ApiError } from '@/api/client'
import type { Network, Wallet } from '@/contracts'
import { Field } from '@/features/auth/Field'
import { useCreateWallet, useUpdateWallet } from './queries'
import { Button } from '@/components/ui/button'

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/
const NETWORKS: { value: Network; label: string }[] = [
  { value: 'ethereum', label: 'Ethereum' },
  { value: 'polygon', label: 'Polygon' },
  { value: 'base', label: 'Base' },
]

interface Props {
  wallet?: Wallet
  defaultKind: Wallet['kind']
  onDone: () => void
  onCancel: () => void
}

export function WalletForm({ wallet, defaultKind, onDone, onCancel }: Props) {
  const create = useCreateWallet()
  const update = useUpdateWallet()
  const mutation = wallet ? update : create
  const [values, setValues] = useState({
    label: wallet?.label ?? '',
    address: wallet?.address ?? '',
    network: wallet?.network ?? ('ethereum' as Network),
    kind: wallet?.kind ?? defaultKind,
  })
  const [submitted, setSubmitted] = useState(false)

  const clientErrors = submitted
    ? {
        label: !values.label.trim() ? 'Informe um nome para a carteira' : undefined,
        address: !ADDRESS_RE.test(values.address)
          ? 'Endereço inválido (0x seguido de 40 caracteres hexadecimais)'
          : undefined,
      }
    : {}
  const apiError = mutation.error instanceof ApiError ? mutation.error : undefined
  const errors: Partial<Record<string, string>> = { ...(apiError?.fieldErrors ?? {}), ...clientErrors }
  const formError =
    apiError && !apiError.fieldErrors
      ? apiError.message
      : mutation.isError && !apiError
        ? 'Erro inesperado'
        : undefined

  const edit = (patch: Partial<typeof values>) => {
    mutation.reset()
    setValues({ ...values, ...patch })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (mutation.isPending || !values.label.trim() || !ADDRESS_RE.test(values.address)) return
    const body = { ...values, label: values.label.trim() }
    if (wallet) update.mutate({ id: wallet.id, ...body }, { onSuccess: onDone })
    else create.mutate(body, { onSuccess: onDone })
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded border p-4">
      <h3 className="font-semibold">{wallet ? `Editar ${wallet.label}` : 'Nova carteira'}</h3>
      <Field
        label="Nome"
        value={values.label}
        error={errors.label}
        onChange={(e) => edit({ label: e.target.value })}
      />
      <Field
        label="Endereço"
        value={values.address}
        error={errors.address}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => edit({ address: e.target.value })}
      />
      <div>
        <label htmlFor={`network-${wallet?.id ?? 'new'}`} className="block text-sm font-medium">
          Rede
        </label>
        <select
          id={`network-${wallet?.id ?? 'new'}`}
          value={values.network}
          className="border px-2 py-2"
          onChange={(e) => edit({ network: e.target.value as Network })}
        >
          {NETWORKS.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label}
            </option>
          ))}
        </select>
        {errors.network && (
          <p role="alert" className="text-sm">
            {errors.network}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={`kind-${wallet?.id ?? 'new'}`} className="block text-sm font-medium">
          Tipo
        </label>
        <select
          id={`kind-${wallet?.id ?? 'new'}`}
          value={values.kind}
          className="border px-2 py-2"
          onChange={(e) => edit({ kind: e.target.value as Wallet['kind'] })}
        >
          <option value="primary">Principal</option>
          <option value="secondary">Secundária</option>
        </select>
        {errors.kind && (
          <p role="alert" className="text-sm">
            {errors.kind}
          </p>
        )}
      </div>
      {formError && <p role="alert">{formError}</p>}
      <div className="flex gap-3">
        <Button variant="default" type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : 'Salvar carteira'}
        </Button>
        <Button variant="link" size="inline" type="button" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
