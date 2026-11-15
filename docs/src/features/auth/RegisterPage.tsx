import { useState, type FormEvent } from 'react'
import { getRouteApi, Link, useRouter } from '@tanstack/react-router'
import { ApiError } from '@/api/client'
import { Field } from './Field'
import { useRegister } from './session'
import { hasErrors, registerErrors } from './validation'
import { Button } from '@/components/ui/button'
import { usePageTitle } from '@/lib/use-page-title'

const route = getRouteApi('/register')

export function RegisterPage() {
  usePageTitle('Criar conta')
  const { redirect } = route.useSearch()
  const router = useRouter()
  const register = useRegister()
  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [submitted, setSubmitted] = useState(false)

  const clientErrors = submitted ? registerErrors(values) : {}
  const apiError = register.error instanceof ApiError ? register.error : undefined
  const errors = { ...(apiError?.fieldErrors ?? {}), ...clientErrors }
  const formError =
    apiError && !apiError.fieldErrors
      ? apiError.message
      : register.isError && !apiError
        ? 'Erro inesperado'
        : undefined

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (register.isPending || hasErrors(registerErrors(values))) return
    register.mutate(values, { onSuccess: () => router.history.replace(redirect ?? '/') })
  }

  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-bold">Criar conta</h1>

      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        <Field
          label="Nome"
          autoComplete="name"
          value={values.name}
          error={errors.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
        />
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
          autoComplete="new-password"
          value={values.password}
          error={errors.password}
          onChange={(e) => setValues({ ...values, password: e.target.value })}
        />

        {formError && <p role="alert">{formError}</p>}

        <Button variant="default" className="w-full" type="submit" disabled={register.isPending}>
          {register.isPending ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>

      <p className="mt-4 text-sm">
        Já tem conta?{' '}
        <Link to="/login" search={{ redirect }} className="underline">
          Entrar
        </Link>
      </p>
    </main>
  )
}
