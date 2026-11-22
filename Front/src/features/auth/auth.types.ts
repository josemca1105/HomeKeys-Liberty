export type UserRole = 'ADMIN' | 'PARTNER'

export interface AuthUser {
  id: number
  firstName: string
  lastName: string
  email: string
  phone: string
  photoUrl: string | null
  role: UserRole
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
  updatedAt: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface LoginData {
  token: string
  user: AuthUser
}

export type NoticeTone = 'warning' | 'success' | 'error'

export interface AuthNotice {
  tone: NoticeTone
  message: string
}

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated'
