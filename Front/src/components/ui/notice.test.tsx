import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Notice } from './notice'

describe('Notice', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cierra automáticamente un aviso de éxito con contador', () => {
    const onDismiss = vi.fn()

    render(
      <Notice
        notice={{ tone: 'success', message: 'Sesión cerrada.' }}
        autoDismissMs={5_000}
        onDismiss={onDismiss}
      />,
    )

    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    expect(screen.getByText('5 s')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('pausa el contador mientras el aviso tiene foco', () => {
    const onDismiss = vi.fn()
    const { container } = render(
      <Notice
        notice={{ tone: 'success', message: 'Sesión cerrada.' }}
        autoDismissMs={5_000}
        onDismiss={onDismiss}
      />,
    )
    const notice = container.firstElementChild

    expect(notice).not.toBeNull()

    if (!notice) {
      return
    }

    fireEvent.focus(notice)

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(onDismiss).not.toHaveBeenCalled()

    fireEvent.blur(notice)

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('permite cerrar manualmente avisos sin temporizador', () => {
    const onDismiss = vi.fn()

    render(
      <Notice
        notice={{ tone: 'warning', message: 'Inicia sesión nuevamente.' }}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar aviso' }))

    expect(onDismiss).toHaveBeenCalledOnce()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})
