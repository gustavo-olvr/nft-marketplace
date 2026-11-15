export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type FieldErrors = Partial<Record<string, string>>

export function passwordIssue(password: string): string | undefined {
  if (password.length < 8) return 'Mínimo de 8 caracteres'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Use letras e números'
  return undefined
}

export function loginErrors(values: { email: string; password: string }): FieldErrors {
  return {
    email: !EMAIL_RE.test(values.email) ? 'Informe um e-mail válido' : undefined,
    password: !values.password ? 'Informe a senha' : undefined,
  }
}

export function registerErrors(values: { name: string; email: string; password: string }): FieldErrors {
  return {
    name: !values.name.trim() ? 'Informe seu nome' : undefined,
    email: !EMAIL_RE.test(values.email) ? 'Informe um e-mail válido' : undefined,
    password: passwordIssue(values.password),
  }
}

export const hasErrors = (errors: FieldErrors) => Object.values(errors).some(Boolean)
