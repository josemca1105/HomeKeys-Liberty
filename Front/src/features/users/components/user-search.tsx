import { Search, X } from 'lucide-react'
import type { FormEvent } from 'react'

interface UserSearchProps {
  initialValue: string
  onSearch: (value: string) => void
}

export function UserSearch({ initialValue, onSearch }: UserSearchProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const value = String(formData.get('search') ?? '').trim()

    onSearch(value)
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="flex min-w-0 flex-1 gap-2">
      <div className="relative min-w-0 flex-1">
        <label htmlFor="user-search" className="sr-only">
          Buscar usuarios
        </label>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
        />
        <input
          key={initialValue}
          id="user-search"
          name="search"
          type="search"
          defaultValue={initialValue}
          maxLength={100}
          placeholder="Buscar por nombre o correo"
          className="h-12 w-full rounded-xl border border-line bg-white pl-10 pr-14 text-base text-ink placeholder:text-[#8499a3] hover:border-[#b8cbd2] focus:border-brand-600"
        />
        {initialValue ? (
          <button
            type="button"
            onClick={() => onSearch('')}
            aria-label="Limpiar búsqueda"
            className="absolute right-0 top-0 grid size-12 place-items-center rounded-xl text-ink-muted hover:bg-surface hover:text-brand-800"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
      <button
        type="submit"
        className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white transition-colors hover:bg-brand-800"
        aria-label="Buscar usuarios"
      >
        <Search aria-hidden="true" className="size-4.5" />
      </button>
    </form>
  )
}
