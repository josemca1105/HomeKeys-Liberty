import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppProviders } from '@/app/providers'
import { AppRoutes } from '@/app/router'

export function renderApp(initialEntries: string[] = ['/']) {
  return render(
    <AppProviders>
      <MemoryRouter initialEntries={initialEntries}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>,
  )
}
