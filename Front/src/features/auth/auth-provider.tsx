import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearAccessToken, getAccessToken, setAccessToken } from '@/api/access-token'
import { normalizeApiError } from '@/api/errors'
import { getJwtExpirationMs } from '@/lib/jwt'
import { getCurrentUserRequest, loginRequest, logoutRequest } from './auth.api'
import { AuthContext, type AuthContextValue } from './auth-context'
import type {
  AuthNotice,
  AuthStatus,
  AuthUser,
  LoginInput,
} from './auth.types'

interface AuthProviderProps {
  children: ReactNode
}

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  expiresAt: number | null
  notice: AuthNotice | null
}

const EXPIRED_SESSION_NOTICE: AuthNotice = {
  tone: 'warning',
  message: 'Tu sesión ha expirado o ya no es válida. Inicia sesión nuevamente.',
}

const INITIAL_STATE: AuthState = {
  status: 'initializing',
  user: null,
  expiresAt: null,
  notice: null,
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient()
  const [state, setState] = useState<AuthState>(INITIAL_STATE)

  const endLocalSession = useCallback(
    (notice: AuthNotice | null) => {
      clearAccessToken()
      queryClient.clear()
      setState({
        status: 'unauthenticated',
        user: null,
        expiresAt: null,
        notice,
      })
    },
    [queryClient],
  )

  useEffect(() => {
    let isCurrent = true

    const restoreSession = async () => {
      const token = getAccessToken()

      if (!token) {
        if (isCurrent) {
          setState({
            status: 'unauthenticated',
            user: null,
            expiresAt: null,
            notice: null,
          })
        }
        return
      }

      const expiration = getJwtExpirationMs(token)

      if (expiration !== null && expiration <= Date.now()) {
        if (isCurrent) {
          endLocalSession(EXPIRED_SESSION_NOTICE)
        }
        return
      }

      try {
        const user = await getCurrentUserRequest()

        if (isCurrent) {
          setState({
            status: 'authenticated',
            user,
            expiresAt: expiration,
            notice: null,
          })
        }
      } catch (error) {
        if (!isCurrent) {
          return
        }

        const apiError = normalizeApiError(error)
        const message =
          apiError.status === 401
            ? EXPIRED_SESSION_NOTICE.message
            : apiError.status === 403
              ? apiError.message
              : 'No pudimos validar tu sesión. Revisa tu conexión e inicia sesión nuevamente.'

        endLocalSession({ tone: 'warning', message })
      }
    }

    void restoreSession()

    return () => {
      isCurrent = false
    }
  }, [endLocalSession])

  useEffect(() => {
    if (state.status !== 'authenticated' || state.expiresAt === null) {
      return
    }

    const remainingTime = Math.max(state.expiresAt - Date.now(), 0)

    const expirationTimer = window.setTimeout(() => {
      endLocalSession(EXPIRED_SESSION_NOTICE)
    }, remainingTime)

    return () => {
      window.clearTimeout(expirationTimer)
    }
  }, [endLocalSession, state.expiresAt, state.status])

  const login = useCallback(async (input: LoginInput): Promise<AuthUser> => {
    const result = await loginRequest(input)
    const expiration = getJwtExpirationMs(result.token)

    setAccessToken(result.token)
    setState({
      status: 'authenticated',
      user: result.user,
      expiresAt: expiration,
      notice: null,
    })

    return result.user
  }, [])

  const logout = useCallback(async (): Promise<void> => {
    try {
      await logoutRequest()
    } catch {
      // Local credentials are always removed, even if server revocation fails.
    } finally {
      endLocalSession({
        tone: 'success',
        message: 'Has cerrado sesión correctamente.',
      })
    }
  }, [endLocalSession])

  const updateUser = useCallback((user: AuthUser) => {
    setState((current) =>
      current.status === 'authenticated'
        ? { ...current, user }
        : current,
    )
  }, [])

  const endSession = useCallback(
    (notice: AuthNotice) => {
      endLocalSession(notice)
    },
    [endLocalSession],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      notice: state.notice,
      login,
      logout,
      updateUser,
      endSession,
    }),
    [
      endSession,
      login,
      logout,
      state.notice,
      state.status,
      state.user,
      updateUser,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
