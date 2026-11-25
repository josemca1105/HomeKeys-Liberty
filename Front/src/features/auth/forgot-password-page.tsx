import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { normalizeApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/notice'
import { AuthTextField } from './components/auth-fields'
import { AuthPageShell } from './components/auth-shell'
import { forgotPasswordRequest } from './auth.api'
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from './forgot-password.schema'

export function ForgotPasswordPage() {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [sentEmail, setSentEmail] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  useEffect(() => {
    document.title = 'Recuperar contraseña | HomeKeys Liberty'
  }, [])

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setSubmitError(null)

    try {
      await forgotPasswordRequest(values.email)
      setSentEmail(values.email)
    } catch (error) {
      setSubmitError(normalizeApiError(error).message)
    }
  }

  if (sentEmail) {
    return (
      <AuthPageShell>
        <div className="flex items-center gap-2" aria-hidden="true">
          <span className="h-1 w-12 rounded-full bg-brand-700" />
          <span className="h-1 w-5 rounded-full bg-brand-cyan" />
          <span className="h-1 w-2.5 rounded-full bg-brand-gold" />
        </div>

        <span className="mt-7 grid size-12 place-items-center rounded-2xl bg-[#e9f8fb] text-brand-cyan-ink">
          <MailCheck aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-5 text-sm font-semibold text-brand-slate">
          Revisa tu correo
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-brand-950">
          Enlace enviado
        </h1>
        <p className="mt-3 text-base leading-7 text-ink-muted">
          Si <strong>{sentEmail}</strong> está registrado, recibirás un enlace
          para crear una nueva contraseña. El enlace es de un solo uso.
        </p>

        <Link
          to="/login"
          className="mt-7 inline-flex min-h-12 items-center gap-1.5 rounded-lg text-sm font-semibold text-brand-700 hover:text-brand-900"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver al inicio de sesión
        </Link>

        <button
          type="button"
          onClick={() => setSentEmail(null)}
          className="mt-3 block min-h-12 text-sm font-semibold text-ink-muted hover:text-brand-800"
        >
          Usar otro correo
        </button>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell>
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="h-1 w-12 rounded-full bg-brand-700" />
        <span className="h-1 w-5 rounded-full bg-brand-cyan" />
        <span className="h-1 w-2.5 rounded-full bg-brand-gold" />
      </div>

      <p className="mt-7 text-sm font-semibold text-brand-slate">
        Recuperar acceso
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.04em] text-brand-950 sm:text-[2.75rem]">
        Recupera tu contraseña
      </h1>
      <p className="mt-3 text-base leading-7 text-ink-muted">
        Escribe el correo de tu cuenta y te enviaremos un enlace para crear una
        nueva contraseña.
      </p>

      {submitError ? (
        <Notice
          notice={{ tone: 'error', message: submitError }}
          className="mt-6"
          onDismiss={() => setSubmitError(null)}
        />
      ) : null}

      <form
        className="mt-7 space-y-5"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <AuthTextField
          id="forgot-email"
          label="Correo electrónico"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="nombre@correo.com"
          registration={register('email')}
          error={errors.email?.message}
          disabled={isSubmitting}
          onInput={() => setSubmitError(null)}
        />

        <Button
          type="submit"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          loadingLabel="Enviando enlace…"
        >
          Enviar enlace
        </Button>
      </form>

      <p className="mt-7 border-t border-line pt-5 text-sm leading-6 text-ink-muted">
        <Link
          to="/login"
          className="inline-flex min-h-12 items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-900"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Volver al inicio de sesión
        </Link>
      </p>
    </AuthPageShell>
  )
}
