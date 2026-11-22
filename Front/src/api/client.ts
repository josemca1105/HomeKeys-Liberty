import axios from 'axios'
import { env } from '@/config/env'
import { getAccessToken } from './access-token'

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }

  return config
})
