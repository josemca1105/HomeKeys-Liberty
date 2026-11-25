import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { SessionLoading } from '@/components/feedback/session-loading'
import {
  AdminRoute,
  HomeRedirect,
  ProtectedRoute,
  PublicOnlyRoute,
  UnknownRoute,
} from './route-guards'

const LoginPage = lazy(async () => {
  const module = await import('@/features/auth/login-page')
  return { default: module.LoginPage }
})

const ForgotPasswordPage = lazy(async () => {
  const module = await import('@/features/auth/forgot-password-page')
  return { default: module.ForgotPasswordPage }
})

const ResetPasswordPage = lazy(async () => {
  const module = await import('@/features/auth/reset-password-page')
  return { default: module.ResetPasswordPage }
})

const ChangePasswordPage = lazy(async () => {
  const module = await import('@/features/auth/change-password-page')
  return { default: module.ChangePasswordPage }
})

const ProfilePage = lazy(async () => {
  const module = await import('@/features/auth/profile-page')
  return { default: module.ProfilePage }
})

const DashboardPage = lazy(async () => {
  const module = await import('@/features/dashboard/dashboard-page')
  return { default: module.DashboardPage }
})

const PropertiesPage = lazy(async () => {
  const module = await import('@/features/properties/pages/properties-page')
  return { default: module.PropertiesPage }
})

const PropertyDetailPage = lazy(async () => {
  const module = await import('@/features/properties/pages/property-detail-page')
  return { default: module.PropertyDetailPage }
})

const CreatePropertyPage = lazy(async () => {
  const module = await import(
    '@/features/properties/create/pages/create-property-page'
  )
  return { default: module.CreatePropertyPage }
})

const EditPropertyPage = lazy(async () => {
  const module = await import(
    '@/features/properties/edit/pages/edit-property-page'
  )
  return { default: module.EditPropertyPage }
})

const PropertyPhotosPage = lazy(async () => {
  const module = await import(
    '@/features/properties/photos/pages/property-photos-page'
  )
  return { default: module.PropertyPhotosPage }
})

const UsersPage = lazy(async () => {
  const module = await import('@/features/users/pages/users-page')
  return { default: module.UsersPage }
})

const UserInvitePage = lazy(async () => {
  const module = await import('@/features/users/pages/user-invite-page')
  return { default: module.UserInvitePage }
})

const UserDetailPage = lazy(async () => {
  const module = await import('@/features/users/pages/user-detail-page')
  return { default: module.UserDetailPage }
})

export function AppRoutes() {
  return (
    <Suspense fallback={<SessionLoading message="Cargando el panel…" />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/forgot-password"
            element={<ForgotPasswordPage />}
          />
        </Route>

        <Route
          path="/reset-password"
          element={<ResetPasswordPage />}
        />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route
            path="/cambiar-contrasena"
            element={<ChangePasswordPage />}
          />
          <Route path="/perfil" element={<ProfilePage />} />
          <Route path="/captaciones" element={<PropertiesPage />} />
          <Route path="/captaciones/nueva" element={<CreatePropertyPage />} />
          <Route
            path="/captaciones/:propertyId"
            element={<PropertyDetailPage />}
          />
          <Route
            path="/captaciones/:propertyId/editar"
            element={<EditPropertyPage />}
          />
          <Route
            path="/captaciones/:propertyId/fotos"
            element={<PropertyPhotosPage />}
          />
          <Route element={<AdminRoute />}>
            <Route path="/usuarios" element={<UsersPage />} />
            <Route path="/usuarios/nuevo" element={<UserInvitePage />} />
            <Route path="/usuarios/:userId" element={<UserDetailPage />} />
          </Route>
        </Route>

        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<UnknownRoute />} />
      </Routes>
    </Suspense>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
