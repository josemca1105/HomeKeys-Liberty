import {
  useFormContext,
  type FieldError,
  type FieldErrors,
  type Path,
} from 'react-hook-form'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import type { CreatePropertyFormValues } from '../create-property.schema'

type FormFieldName = Path<CreatePropertyFormValues>

const fieldClassName =
  'mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-3.5 text-base text-ink placeholder:text-[#91a3ac] transition-colors hover:border-[#b8cbd2] focus:border-brand-600'

function getFieldError(
  errors: FieldErrors<CreatePropertyFormValues>,
  name: FormFieldName,
): string | undefined {
  const fieldError = errors[name] as FieldError | undefined
  return fieldError?.message
}

interface FieldShellProps {
  name: FormFieldName
  label: string
  required?: boolean
  hint?: string
  children: ReactNode
}

function FieldShell({
  name,
  label,
  required = false,
  hint,
  children,
}: FieldShellProps) {
  return (
    <div>
      <label
        htmlFor={`create-${name}`}
        className="text-sm font-semibold text-ink"
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-[#9a332b]">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p className="mt-1.5 text-xs leading-5 text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}

interface TextFieldProps {
  name: FormFieldName
  label: string
  required?: boolean
  hint?: string
  placeholder?: string
  type?: InputHTMLAttributes<HTMLInputElement>['type']
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  min?: number | string
  max?: number | string
  step?: number | string
  maxLength?: number
  className?: string
}

export function TextField({
  name,
  label,
  required = false,
  hint,
  placeholder,
  type = 'text',
  inputMode,
  autoComplete,
  min,
  max,
  step,
  maxLength,
  className,
}: TextFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<CreatePropertyFormValues>()
  const error = getFieldError(errors, name)
  const errorId = error ? `create-${name}-error` : undefined

  return (
    <FieldShell
      name={name}
      label={label}
      required={required}
      hint={hint}
    >
      <input
        {...register(name)}
        id={`create-${name}`}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        maxLength={maxLength}
        aria-required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        className={cn(fieldClassName, className)}
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 text-sm text-[#9a332b]"
        >
          {error}
        </p>
      ) : null}
    </FieldShell>
  )
}

interface TextareaFieldProps {
  name: FormFieldName
  label: string
  required?: boolean
  hint?: string
  placeholder?: string
  rows?: number
  maxLength?: number
}

export function TextareaField({
  name,
  label,
  required = false,
  hint,
  placeholder,
  rows = 4,
  maxLength,
}: TextareaFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<CreatePropertyFormValues>()
  const error = getFieldError(errors, name)
  const errorId = error ? `create-${name}-error` : undefined

  return (
    <FieldShell
      name={name}
      label={label}
      required={required}
      hint={hint}
    >
      <textarea
        {...register(name)}
        id={`create-${name}`}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        className={cn(fieldClassName, 'h-auto min-h-28 resize-y py-3')}
      />
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 text-sm text-[#9a332b]"
        >
          {error}
        </p>
      ) : null}
    </FieldShell>
  )
}

interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps {
  name: FormFieldName
  label: string
  options: SelectOption[]
  placeholder?: string
  required?: boolean
  hint?: string
}

export function SelectField({
  name,
  label,
  options,
  placeholder,
  required = false,
  hint,
}: SelectFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext<CreatePropertyFormValues>()
  const error = getFieldError(errors, name)
  const errorId = error ? `create-${name}-error` : undefined

  return (
    <FieldShell
      name={name}
      label={label}
      required={required}
      hint={hint}
    >
      <select
        {...register(name)}
        id={`create-${name}`}
        aria-required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        className={fieldClassName}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 text-sm text-[#9a332b]"
        >
          {error}
        </p>
      ) : null}
    </FieldShell>
  )
}

interface CheckboxFieldProps {
  name: FormFieldName
  label: string
  description?: string
}

export function CheckboxField({
  name,
  label,
  description,
}: CheckboxFieldProps) {
  const { register } = useFormContext<CreatePropertyFormValues>()

  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border border-line bg-white px-3.5 py-3 text-sm text-ink transition-colors hover:border-[#b8cbd2] has-[:checked]:border-brand-600 has-[:checked]:bg-[#f2fafb]">
      <input
        {...register(name)}
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 rounded border-line accent-brand-700"
      />
      <span>
        <span className="block font-semibold">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-5 text-ink-muted">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
}
