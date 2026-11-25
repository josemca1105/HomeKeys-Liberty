import { Navigate, Outlet, useLocation } from 'react-router'
import { SessionLoading } from '@/components/feedback/session-loading'
import { useAuth } from '@/features/auth/auth-context'
import type { AuthNotice } from '@/features/auth/auth.types'

const LOGIN_REQUIRED_NOTICE: AuthNotice = {
  tone: 'warning',
  message: 'Debes iniciar sesión para acceder a esta sección.',
}

export function PublicOnlyRoute() {
  const { status } = useAuth()

  if (status === 'initializing') {
    return <SessionLoading message="Comprobando tu acceso…" />
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

export function ProtectedRoute() {
  const { notice, status, user } = useAuth()
  const location = useLocation()

  if (status === 'initializing') {
    return <SessionLoading />
  }

  if (status === 'unauthenticated') {
    return (
      <Navigate
        to="/login"
        replace
        state={{ notice: notice ?? LOGIN_REQUIRED_NOTICE }}
      />
    )
  }

  if (
    user?.mustChangePassword &&
    location.pathname !== '/cambiar-contrasena'
  ) {
    return <Navigate to="/cambiar-contrasena" replace />
  }

  return <Outlet />
}

export function HomeRedirect() {
  const { notice, status } = useAuth()

  if (status === 'initializing') {
    return <SessionLoading message="Comprobando tu acceso…" />
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <Navigate
      to="/login"
      replace
      {...(notice ? { state: { notice } } : {})}
    />
  )
}

export function UnknownRoute() {
  const { status } = useAuth()

  if (status === 'initializing') {
    return <SessionLoading message="Comprobando tu acceso…" />
  }

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <Navigate
      to="/login"
      replace
      state={{ notice: LOGIN_REQUIRED_NOTICE }}
    />
  )
}

