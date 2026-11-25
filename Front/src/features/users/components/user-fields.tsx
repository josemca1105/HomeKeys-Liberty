import type { InputHTMLAttributes } from 'react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { cn } from '@/lib/cn'

const fieldClassName =
  'h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink shadow-[0_1px_0_rgb(8_39_63/0.03)] placeholder:text-[#91a3ac] transition-colors hover:border-[#b8cbd2] focus:border-brand-600 disabled:bg-surface disabled:text-ink-muted'

interface UserFieldBaseProps {
  id: string
  label: string
  registration: UseFormRegisterReturn
  error?: string
  hint?: string
  disabled?: boolean
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

interface UserTextFieldProps extends UserFieldBaseProps {
  maxLength?: number
  placeholder?: string
  autoComplete?: string
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  type?: string
  onInput?: () => void
}

export function UserTextField({
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
}: UserTextFieldProps) {
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
        <p id={`${id}-hint`} className="mt-2 text-xs leading-5 text-ink-muted">
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

interface UserSelectFieldOption {
  value: string
  label: string
}

interface UserSelectFieldProps extends UserFieldBaseProps {
  options: readonly UserSelectFieldOption[]
}

export function UserSelectField({
  id,
  label,
  registration,
  options,
  error,
  hint,
  disabled,
}: UserSelectFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        {...registration}
        id={id}
        disabled={disabled}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(fieldClassName, 'mt-2 px-3.5')}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-2 text-xs leading-5 text-ink-muted">
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
