import { describe, expect, it } from 'vitest'
import {
  DEFAULT_AUDIT_FILTERS,
  hasAuditFilters,
  parseAuditFilters,
  serializeAuditFilters,
} from './audit-filters'

describe('filtros de auditoría', () => {
  it('interpreta filtros válidos de la URL', () => {
    const filters = parseAuditFilters(
      new URLSearchParams(
        'page=2&scope=SECURITY&action=LOGIN_FAILED&entityType=USER&entityId=4&from=2026-11-01&to=2026-11-24',
      ),
    )

    expect(filters).toMatchObject({
      page: 2,
      scope: 'SECURITY',
      action: 'LOGIN_FAILED',
      entityType: 'USER',
      entityId: 4,
      from: '2026-11-01',
      to: '2026-11-24',
    })
  })

  it('ignora valores inválidos y aplica los valores predeterminados', () => {
    const filters = parseAuditFilters(
      new URLSearchParams(
        'page=0&scope=UNKNOWN&entityType=INVOICE&entityId=-3&from=2026-13-99&to=hola',
      ),
    )

    expect(filters.page).toBe(1)
    expect(filters.scope).toBeUndefined()
    expect(filters.action).toBeUndefined()
    expect(filters.entityType).toBeUndefined()
    expect(filters.entityId).toBeUndefined()
    expect(filters.from).toBeUndefined()
    expect(filters.to).toBeUndefined()
  })

  it('descarta el límite superior cuando desde es posterior a hasta', () => {
    const filters = parseAuditFilters(
      new URLSearchParams('from=2026-11-24&to=2026-11-01'),
    )

    expect(filters.from).toBe('2026-11-24')
    expect(filters.to).toBeUndefined()
  })

  it('serializa y vuelve a interpretar los filtros', () => {
    const filters = parseAuditFilters(
      new URLSearchParams(
        'scope=BUSINESS&action=PROPERTY_UPDATED&entityType=PROPERTY&entityId=12&from=2026-11-01&to=2026-11-24&page=3',
      ),
    )
    const params = serializeAuditFilters(filters)

    expect(params.get('scope')).toBe('BUSINESS')
    expect(params.get('action')).toBe('PROPERTY_UPDATED')
    expect(params.get('entityType')).toBe('PROPERTY')
    expect(params.get('entityId')).toBe('12')
    expect(params.get('from')).toBe('2026-11-01')
    expect(params.get('to')).toBe('2026-11-24')
    expect(params.get('page')).toBe('3')
    expect(parseAuditFilters(params)).toEqual(filters)
  })

  it('detecta si hay filtros activos', () => {
    expect(hasAuditFilters(parseAuditFilters(new URLSearchParams()))).toBe(
      false,
    )
    expect(
      hasAuditFilters(parseAuditFilters(new URLSearchParams('scope=BUSINESS'))),
    ).toBe(true)
    expect(
      hasAuditFilters(parseAuditFilters(new URLSearchParams('entityId=4'))),
    ).toBe(true)
    expect(
      hasAuditFilters(parseAuditFilters(new URLSearchParams('from=2026-11-01'))),
    ).toBe(true)
  })

  it('mantiene los valores predeterminados serializados en blanco', () => {
    const params = serializeAuditFilters(DEFAULT_AUDIT_FILTERS)

    expect(params.toString()).toBe('')
  })
})
