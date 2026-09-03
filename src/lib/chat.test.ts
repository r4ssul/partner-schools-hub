import { describe, expect, it } from 'vitest'
import { mergeMessages, validateMessage, type ChatMessage } from './chat'
import { fromTokyoInput } from './date'
import { createItemSchema, memberInvitationSchema } from './validation'

describe('team chat', () => {
  it('rejects blank and oversized messages', () => {
    expect(validateMessage(' \n ')).not.toBeNull()
    expect(validateMessage('a'.repeat(2001))).not.toBeNull()
    expect(validateMessage('Hello, team 👋')).toBeNull()
  })
  it('deduplicates realtime delivery and sorts history', () => {
    const a = { id: 1, body: 'hello' } as ChatMessage
    const b = { id: 2, body: 'there' } as ChatMessage
    expect(mergeMessages([b], [a, b])).toEqual([a, b])
  })
})
describe('creation dialog validation', () => {
  it('does not require an unused title for file uploads', () => {
    expect(createItemSchema.safeParse({ kind: 'file', title: '' }).success).toBe(true)
    expect(createItemSchema.safeParse({ kind: 'folder', title: ' ' }).success).toBe(false)
  })
  it('rejects missing, invalid, and reversed event end times', () => {
    const event = { kind: 'event', title: 'Team day', startDate: '2026-09-04T10:00' }
    for (const endDate of ['', 'not-a-date', '2026-09-04T09:00', event.startDate]) {
      expect(createItemSchema.safeParse({ ...event, endDate }).success).toBe(false)
    }
    expect(createItemSchema.safeParse({ ...event, endDate: '2026-09-04T11:00' }).success).toBe(true)
  })
  it('uses Tokyo time regardless of the browser timezone', () => {
    expect(fromTokyoInput('2026-09-04T10:00')).toBe('2026-09-04T01:00:00.000Z')
    expect(fromTokyoInput('2026-09-04')).toBe('2026-09-03T15:00:00.000Z')
  })
  it('rejects unsafe links and leadership invitations', () => {
    expect(createItemSchema.safeParse({ kind: 'link', title: 'Unsafe', url: 'javascript:alert(1)' }).success).toBe(false)
    expect(memberInvitationSchema.safeParse({ name: 'New Member', email: 'new@example.com', organization: 'School', jobTitle: '', role: 'super_admin' }).success).toBe(false)
  })
})
