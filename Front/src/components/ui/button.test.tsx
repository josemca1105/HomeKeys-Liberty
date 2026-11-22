import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Button } from './button'

describe('Button', () => {
  it('aplica el ancho completo sin enviar props visuales al DOM', () => {
    render(<Button fullWidth>Entrar al panel</Button>)

    const button = screen.getByRole('button', { name: 'Entrar al panel' })

    expect(button).toHaveClass('w-full')
    expect(button).not.toHaveAttribute('fullWidth')
    expect(button).toHaveAttribute('type', 'button')
  })
})
