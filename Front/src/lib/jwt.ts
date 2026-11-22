interface JwtPayload {
  exp?: unknown
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  const binary = window.atob(`${normalized}${padding}`)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))

  return new TextDecoder().decode(bytes)
}

export function getJwtExpirationMs(token: string): number | null {
  try {
    const payloadSegment = token.split('.')[1]

    if (!payloadSegment) {
      return null
    }

    const payload = JSON.parse(decodeBase64Url(payloadSegment)) as JwtPayload

    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
      return null
    }

    return payload.exp * 1000
  } catch {
    return null
  }
}
