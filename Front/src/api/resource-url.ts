import { env } from '@/config/env'

export function resolveApiResourceUrl(resourceUrl: string): string {
  if (/^https?:\/\//i.test(resourceUrl)) {
    return resourceUrl
  }

  const pageOrigin = window.location.origin
  const apiOrigin = /^https?:\/\//i.test(env.apiBaseUrl)
    ? new URL(env.apiBaseUrl).origin
    : pageOrigin

  if (resourceUrl.startsWith('/')) {
    return new URL(resourceUrl, apiOrigin).toString()
  }

  return new URL(
    `${env.apiBaseUrl.replace(/\/+$/, '')}/${resourceUrl}`,
    pageOrigin,
  ).toString()
}
