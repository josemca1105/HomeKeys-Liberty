import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { SessionLoading } from '@/components/feedback/session-loading'
import {
  HomeRedirect,
  ProtectedRoute,
  PublicOnlyRoute,
  UnknownRoute,
} from './route-guards'

const LoginPage = lazy(async () => {
  const module = await import('@/features/auth/login-page')
  return { default: module.LoginPage }
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

export function AppRoutes() {
  return (
    <Suspense fallback={<SessionLoading message="Cargando el panel…" />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/captaciones" element={<PropertiesPage />} />
          <Route path="/captaciones/nueva" element={<CreatePropertyPage />} />
          <Route
            path="/captaciones/:propertyId"
            element={<PropertyDetailPage />}
          />
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
