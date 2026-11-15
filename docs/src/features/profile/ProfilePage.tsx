import { useState, type ChangeEvent, type FormEvent } from 'react'
import { ApiError } from '@/api/client'
import { Field } from '@/features/auth/Field'
import { EMAIL_RE, passwordIssue } from '@/features/auth/validation'
import { useChangePassword, useProfile, useUpdateAvatar, useUpdateProfile } from './queries'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { usePageTitle } from '@/lib/use-page-title'

const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const AVATAR_MAX_BYTES = 200 * 1024
const BIO_MAX = 280

const fieldErrorsOf = (error: unknown) => (error instanceof ApiError ? (error.fieldErrors ?? {}) : {})
const messageOf = (error: unknown) =>
  error instanceof ApiError && !error.fieldErrors ? error.message : error ? 'Erro inesperado' : undefined

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function DataSection({ name, email, bio }: { name: string; email: string; bio: string }) {
  const update = useUpdateProfile()
  const [edits, setEdits] = useState<{ name?: string; email?: string; bio?: string }>({})
  const [submitted, setSubmitted] = useState(false)

  const values = { name: edits.name ?? name, email: edits.email ?? email, bio: edits.bio ?? bio }
  const clientErrors = submitted
    ? {
        name: !values.name.trim() ? 'Informe seu nome' : undefined,
        email: !EMAIL_RE.test(values.email) ? 'Informe um e-mail válido' : undefined,
        bio: values.bio.length > BIO_MAX ? `Máximo de ${BIO_MAX} caracteres` : undefined,
      }
    : {}
  const errors: Partial<Record<string, string>> = { ...fieldErrorsOf(update.error), ...clientErrors }

  const edit = (patch: typeof edits) => {
    update.reset()
    setEdits({ ...edits, ...patch })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (update.isPending) return
    if (!values.name.trim() || !EMAIL_RE.test(values.email) || values.bio.length > BIO_MAX) return
    update.mutate(
      { name: values.name, email: values.email, bio: values.bio },
      { onSuccess: () => setEdits({}) },
    )
  }

  return (
    <section aria-labelledby="data-title" className="space-y-4">
      <h2 id="data-title" className="text-lg font-semibold">
        Dados pessoais
      </h2>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field
          label="Nome"
          autoComplete="name"
          value={values.name}
          error={errors.name}
          onChange={(e) => edit({ name: e.target.value })}
        />
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(e) => edit({ email: e.target.value })}
        />
        <div>
          <label htmlFor="bio" className="block text-sm font-medium">
            Bio
          </label>
          <textarea
            id="bio"
            rows={3}
            value={values.bio}
            onChange={(e) => edit({ bio: e.target.value })}
            aria-invalid={errors.bio ? true : undefined}
            aria-describedby="bio-hint"
            className="w-full border px-3 py-2"
          />
          <p id="bio-hint" className="text-sm text-muted-foreground">
            {values.bio.length}/{BIO_MAX} caracteres
          </p>
          {errors.bio && (
            <p role="alert" className="text-sm">
              {errors.bio}
            </p>
          )}
        </div>
        {messageOf(update.error) && <p role="alert">{messageOf(update.error)}</p>}
        <div aria-live="polite">{update.isSuccess && <p role="status">Dados salvos.</p>}</div>
        <Button variant="default" type="submit" disabled={update.isPending}>
          {update.isPending ? 'Salvando…' : 'Salvar dados'}
        </Button>
      </form>
    </section>
  )
}

function AvatarSection({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const update = useUpdateAvatar()
  const [localError, setLocalError] = useState<string>()

  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    update.reset()
    setLocalError(undefined)
    if (!file) return
    if (!AVATAR_TYPES.includes(file.type)) return setLocalError('Use uma imagem PNG, JPEG ou WebP')
    if (file.size > AVATAR_MAX_BYTES) return setLocalError('A imagem deve ter no máximo 200 KB')
    update.mutate({ dataUrl: await readAsDataUrl(file) })
  }

  const error = localError ?? fieldErrorsOf(update.error).avatar ?? messageOf(update.error)

  return (
    <section aria-labelledby="avatar-title" className="space-y-3">
      <h2 id="avatar-title" className="text-lg font-semibold">
        Avatar
      </h2>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={`Avatar de ${name}`}
          width={96}
          height={96}
          className="h-24 w-24 rounded-full object-cover"
        />
      ) : (
        <div
          className="flex h-24 w-24 items-center justify-center rounded-full border text-2xl"
          role="img"
          aria-label="Sem avatar"
        >
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div>
        <label htmlFor="avatar" className="block text-sm font-medium">
          Enviar nova imagem
        </label>
        <input
          id="avatar"
          type="file"
          accept={AVATAR_TYPES.join(',')}
          onChange={pick}
          aria-describedby="avatar-hint"
          disabled={update.isPending}
        />
        <p id="avatar-hint" className="text-sm text-muted-foreground">
          PNG, JPEG ou WebP, até 200 KB.
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      <div aria-live="polite">
        {update.isPending && <p role="status">Enviando avatar…</p>}
        {update.isSuccess && <p role="status">Avatar atualizado.</p>}
      </div>
    </section>
  )
}

function PasswordSection() {
  const change = useChangePassword()
  const empty = { currentPassword: '', newPassword: '', confirm: '' }
  const [values, setValues] = useState(empty)
  const [submitted, setSubmitted] = useState(false)

  const clientErrors = submitted
    ? {
        currentPassword: !values.currentPassword ? 'Informe a senha atual' : undefined,
        newPassword: passwordIssue(values.newPassword),
        confirm: values.confirm !== values.newPassword ? 'As senhas não conferem' : undefined,
      }
    : {}
  const errors: Partial<Record<string, string>> = { ...fieldErrorsOf(change.error), ...clientErrors }

  const edit = (patch: Partial<typeof values>) => {
    change.reset()
    setValues({ ...values, ...patch })
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (change.isPending) return
    if (!values.currentPassword || passwordIssue(values.newPassword) || values.confirm !== values.newPassword)
      return
    change.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: () => {
          setValues(empty)
          setSubmitted(false)
        },
      },
    )
  }

  return (
    <section aria-labelledby="password-title" className="space-y-4">
      <h2 id="password-title" className="text-lg font-semibold">
        Alterar senha
      </h2>
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field
          label="Senha atual"
          type="password"
          autoComplete="current-password"
          value={values.currentPassword}
          error={errors.currentPassword}
          onChange={(e) => edit({ currentPassword: e.target.value })}
        />
        <Field
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          value={values.newPassword}
          error={errors.newPassword}
          onChange={(e) => edit({ newPassword: e.target.value })}
        />
        <Field
          label="Confirmar nova senha"
          type="password"
          autoComplete="new-password"
          value={values.confirm}
          error={errors.confirm}
          onChange={(e) => edit({ confirm: e.target.value })}
        />
        {messageOf(change.error) && <p role="alert">{messageOf(change.error)}</p>}
        <div aria-live="polite">{change.isSuccess && <p role="status">Senha alterada.</p>}</div>
        <Button variant="default" type="submit" disabled={change.isPending}>
          {change.isPending ? 'Alterando…' : 'Alterar senha'}
        </Button>
      </form>
    </section>
  )
}

export function ProfilePage() {
  usePageTitle('Perfil')
  const { data, isPending, isError, error, refetch } = useProfile()

  if (isPending) {
    return (
      <main className="p-6" role="status">
        <span className="sr-only">Carregando perfil…</span>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-4 h-48 w-full max-w-md" />
      </main>
    )
  }

  if (isError) {
    return (
      <main className="p-6" role="alert">
        <p>Não foi possível carregar o perfil: {error.message}</p>
        <Button variant="link" size="inline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-xl space-y-10 p-6">
      <h1 className="text-2xl font-bold">Perfil do colecionador</h1>
      <AvatarSection name={data.name} avatarUrl={data.avatarUrl} />
      <DataSection name={data.name} email={data.email} bio={data.bio} />
      <PasswordSection />
    </main>
  )
}
