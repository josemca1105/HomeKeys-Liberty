const ACCESS_TOKEN_KEY = 'homekeys.access-token'

function readStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

let accessToken = readStoredToken()

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string): void {
  accessToken = token

  try {
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
  } catch {
    // The in-memory token still keeps the current tab authenticated.
  }
}

export function clearAccessToken(): void {
  accessToken = null

  try {
    window.sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  } catch {
    // There is nothing else to clear when session storage is unavailable.
  }
}
