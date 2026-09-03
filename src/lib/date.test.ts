import { describe, expect, it } from 'vitest'
import { dateKeyInTimeZone, sameDay, toInputDateTime } from './date'

describe('Asia/Tokyo date handling', () => {
  it('uses the company day across the UTC boundary', () => {
    expect(dateKeyInTimeZone('2026-09-02T15:30:00Z')).toBe('2026-09-03')
    expect(sameDay('2026-09-02T15:30:00Z', '2026-09-03T08:00:00+09:00')).toBe(true)
  })

  it('formats datetime-local values in Tokyo rather than the machine timezone', () => {
    expect(toInputDateTime('2026-09-02T23:15:00Z')).toBe('2026-09-03T08:15')
  })
})
