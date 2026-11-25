import { Check, Eye, EyeOff } from 'lucide-react'
import { useState, type InputHTMLAttributes } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { cn } from '@/lib/cn'
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '../password-policy'

const fieldClassName =
  'h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink shadow-[0_1px_0_rgb(8_39_63/0.03)] placeholder:text-[#91a3ac] transition-colors hover:border-[#b8cbd2] focus:border-brand-600 disabled:bg-surface disabled:text-ink-muted'

interface AuthFieldProps {
  id: string
  label: string
  registration: UseFormRegisterReturn
  error?: string
  hint?: string
  disabled?: boolean
  maxLength?: number
  placeholder?: string
  autoComplete?: string
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  type?: string
  onInput?: () => void
}

function describedBy(
  id: string,
  error: string | undefined,
  hint: string | undefined,
): string | undefined {
  const ids = [
    error ? `${id}-error` : null,
    hint ? `${id}-hint` : null,
  ].filter(Boolean)

  return ids.length > 0 ? ids.join(' ') : undefined
}

export function AuthTextField({
  id,
  label,
  registration,
  error,
  hint,
  disabled,
  maxLength,
  placeholder,
  autoComplete,
  inputMode,
  type = 'text',
  onInput,
}: AuthFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <input
        {...registration}
        id={id}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        onInput={onInput}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(fieldClassName, 'mt-2')}
      />
      {hint && !error ? (
        <p
          id={`${id}-hint`}
          className="mt-2 text-xs leading-5 text-ink-muted"
        >
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-2 text-sm text-[#9a332b]"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function AuthPasswordField({
  id,
  label,
  registration,
  error,
  hint,
  disabled,
  maxLength,
  placeholder,
  autoComplete = 'new-password',
  onInput,
}: AuthFieldProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative mt-2">
        <input
          {...registration}
          id={id}
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          onInput={onInput}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(fieldClassName, 'pr-14')}
        />
        <button
          type="button"
          onClick={() => setShowPassword((current) => !current)}
          className="absolute right-0 top-0 grid size-12 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface hover:text-brand-800"
          aria-label={
            showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
          }
          aria-pressed={showPassword}
          disabled={disabled}
        >
          {showPassword ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
      {hint && !error ? (
        <p
          id={`${id}-hint`}
          className="mt-2 text-xs leading-5 text-ink-muted"
        >
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="mt-2 text-sm text-[#9a332b]"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

const REQUIREMENT_CHECKS = [
  {
    label: `Mínimo ${PASSWORD_MIN_LENGTH} caracteres`,
    met: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    label: 'Una letra mayúscula',
    met: (value: string) => /\p{Lu}/u.test(value),
  },
  {
    label: 'Una letra minúscula',
    met: (value: string) => /\p{Ll}/u.test(value),
  },
  {
    label: 'Un número',
    met: (value: string) => /\p{N}/u.test(value),
  },
  {
    label: 'Un carácter especial',
    met: (value: string) => /[\p{P}\p{S}]/u.test(value),
  },
  {
    label: `Máximo ${PASSWORD_MAX_LENGTH} caracteres`,
    met: (value: string) => value.length <= PASSWORD_MAX_LENGTH,
  },
] as const

export function PasswordPolicyHints({
  password = '',
}: {
  password?: string
}) {
  return (
    <ul
      className="mt-2 grid gap-1 text-xs leading-5 sm:grid-cols-2"
      aria-label="Requisitos de la contraseña"
    >
      {REQUIREMENT_CHECKS.map((requirement) => {
        const isMet = requirement.met(password)

        return (
          <li
            key={requirement.label}
            data-met={isMet ? 'true' : 'false'}
            className={cn(
              'flex items-center gap-1.5',
              isMet ? 'font-medium text-[#176444]' : 'text-ink-muted',
            )}
          >
            {isMet ? (
              <Check aria-hidden="true" className="size-3.5" />
            ) : (
              <span
                aria-hidden="true"
                className="size-1 rounded-full bg-brand-slate"
              />
            )}
            {requirement.label}
          </li>
        )
      })}
    </ul>
  )
}
