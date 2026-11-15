import { useState, type FormEvent } from 'react'
import { getRouteApi, Link, useRouter } from '@tanstack/react-router'
import { ApiError } from '@/api/client'
import { Field } from './Field'
import { useLogin } from './session'
import { hasErrors, loginErrors } from './validation'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/lib/use-page-title'

const route = getRouteApi('/login')

export function LoginPage() {
  usePageTitle('Entrar')
  const { redirect, expired } = route.useSearch()
  const router = useRouter()
  const login = useLogin()
  const [values, setValues] = useState({ email: '', password: '' })
  const [submitted, setSubmitted] = useState(false)

  const clientErrors = submitted ? loginErrors(values) : {}
  const apiError = login.error instanceof ApiError ? login.error : undefined
  const serverErrors = apiError?.fieldErrors ?? {}
  const errors = { ...serverErrors, ...clientErrors }
  const formError =
    apiError && !apiError.fieldErrors
      ? apiError.message
      : login.isError && !apiError
        ? 'Erro inesperado'
        : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (login.isPending || hasErrors(loginErrors(values))) return
    login.mutate(values, { onSuccess: () => router.history.replace(redirect ?? '/') })
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-bold">Entrar</h1>
      {expired && (
        <p role="status" className="mt-2">
          Sua sessão expirou. Entre novamente para continuar.
        </p>
      )}

      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <Field
          label="E-mail"
          type="email"
          autoComplete="email"
          value={values.email}
          error={errors.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
        />
        <Field
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={values.password}
          error={errors.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
        />

        {formError && <p role="alert">{formError}</p>}

        <Button variant="default" className="w-full" type="submit" disabled={login.isPending}>
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>

      <p className="mt-4 text-sm">
        Ainda não tem conta?{' '}
        <Link to="/register" search={{ redirect }} className="underline">
          Criar conta
        </Link>
      </p>
    </main>
  )
}
