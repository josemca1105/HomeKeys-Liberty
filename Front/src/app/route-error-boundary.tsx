import { ArrowLeft, RefreshCw, TriangleAlert } from 'lucide-react'
import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

interface RouteErrorBoundaryProps {
  children: ReactNode
}

interface RouteErrorBoundaryState {
  error: Error | null
}

// React error boundaries catch errors thrown while rendering, including lazy
// route chunks that fail to load. They do not catch event handlers or async
// code; those already surface through the per-page error states.
export class RouteErrorBoundary extends Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  state: RouteErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): RouteErrorBoundaryState {
    return { error }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Intentionally quiet: React already logs the caught error and its
    // component stack. This hook is the place to forward errors to a
    // telemetry service in the future.
  }

  render() {
    if (this.state.error === null) {
      return this.props.children
    }

    return <RouteErrorFallback error={this.state.error} />
  }
}

function RouteErrorFallback({ error }: { error: Error }) {
  useEffect(() => {
    document.title = 'Error | HomeKeys Liberty'
  }, [])

  return (
    <div className="grid min-h-dvh place-items-center bg-surface px-6">
      <div className="w-full max-w-md rounded-2xl border border-[#e7b2ae] bg-white p-7 text-center shadow-panel">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff2f0] text-[#9a332b]">
          <TriangleAlert aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-5 font-display text-3xl font-semibold tracking-[-0.035em] text-brand-950">
          Algo salió mal
        </h1>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          La sección no pudo mostrarse por un error inesperado. Tus datos están
          a salvo: recarga la página o vuelve al inicio para continuar.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button type="button" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden="true" className="size-4" />
            Reintentar
          </Button>
          <Link
            to="/"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 text-sm font-semibold text-brand-900 hover:bg-surface"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Volver al inicio
          </Link>
        </div>
        <details className="mt-6 text-left">
          <summary className="cursor-pointer text-xs font-semibold text-ink-muted">
            Detalles técnicos
          </summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-surface px-3 py-2 text-xs leading-5 text-ink-muted">
            {error.message}
          </pre>
        </details>
      </div>
    </div>
  )
}
