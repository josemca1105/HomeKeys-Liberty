import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { env } from '@/config/env'
import { server } from '@/test/msw/server'
import { auditDateToIsoBound, fetchAuditLogs } from './audit.api'
import { DEFAULT_AUDIT_FILTERS } from './audit-filters'

const auditLogsUrl = `${env.apiBaseUrl}/audit-logs`

describe('fetchAuditLogs', () => {
  it('envía los filtros con límites de día en UTC', async () => {
    let captured: URL | null = null

    server.use(
      http.get(auditLogsUrl, ({ request }) => {
        captured = new URL(request.url)

        return HttpResponse.json({
          success: true,
          message: 'Historial obtenido exitosamente.',
          data: {
            logs: [],
            pagination: { page: 2, pageSize: 20, total: 0, totalPages: 0 },
          },
        })
      }),
    )

    const data = await fetchAuditLogs(
      {
        ...DEFAULT_AUDIT_FILTERS,
        page: 2,
        scope: 'SECURITY',
        action: 'LOGIN_FAILED',
        entityType: 'USER',
        entityId: 4,
        from: '2026-11-01',
        to: '2026-11-24',
      },
      new AbortController().signal,
    )

    // The handler runs inside an MSW closure; read the captured URL through a
    // closure as well so TypeScript control flow can narrow it.
    const readParam = (key: string) => captured?.searchParams.get(key)

    expect(data.logs).toEqual([])
    expect(readParam('page')).toBe('2')
    expect(readParam('pageSize')).toBe('20')
    expect(readParam('scope')).toBe('SECURITY')
    expect(readParam('action')).toBe('LOGIN_FAILED')
    expect(readParam('entityType')).toBe('USER')
    expect(readParam('entityId')).toBe('4')
    expect(readParam('from')).toBe('2026-11-01T00:00:00.000Z')
    expect(readParam('to')).toBe('2026-11-24T23:59:59.999Z')
  })

  it('omite los filtros vacíos', async () => {
    let captured: URL | null = null

    server.use(
      http.get(auditLogsUrl, ({ request }) => {
        captured = new URL(request.url)

        return HttpResponse.json({
          success: true,
          message: 'Historial obtenido exitosamente.',
          data: {
            logs: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          },
        })
      }),
    )

    await fetchAuditLogs(DEFAULT_AUDIT_FILTERS, new AbortController().signal)

    const readParam = (key: string) => captured?.searchParams.get(key)

    expect(readParam('page')).toBe('1')
    expect(readParam('scope')).toBeNull()
    expect(readParam('action')).toBeNull()
    expect(readParam('entityType')).toBeNull()
    expect(readParam('entityId')).toBeNull()
    expect(readParam('from')).toBeNull()
    expect(readParam('to')).toBeNull()
  })
})

describe('auditDateToIsoBound', () => {
  it('expande las fechas a límites de día UTC', () => {
    expect(auditDateToIsoBound('2026-11-01', false)).toBe(
      '2026-11-01T00:00:00.000Z',
    )
    expect(auditDateToIsoBound('2026-11-24', true)).toBe(
      '2026-11-24T23:59:59.999Z',
    )
  })
})
