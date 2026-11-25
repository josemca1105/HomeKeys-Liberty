import { createContext, useContext } from 'react'
import type {
  AuthNotice,
  AuthStatus,
  AuthUser,
  LoginInput,
} from './auth.types'

export interface AuthContextValue {
  status: AuthStatus
  user: AuthUser | null
  notice: AuthNotice | null
  login: (input: LoginInput) => Promise<AuthUser>
  logout: () => Promise<void>
  updateUser: (user: AuthUser) => void
  endSession: (notice: AuthNotice) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de AuthProvider.')
  }

  return context
}
