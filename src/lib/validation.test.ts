import { describe, expect, it } from 'vitest'
import { createItemSchema, MAX_FILE_BYTES, memberInvitationSchema, memberProfileSchema, validateUpload } from './validation'

describe('createItemSchema', () => {
  it('accepts a complete task', () => {
    const result = createItemSchema.safeParse({ kind: 'task', title: 'Review vendor terms', dueDate: '2026-09-05', priority: 'high' })
    expect(result.success).toBe(true)
  })

  it('requires dates for events and tasks', () => {
    expect(createItemSchema.safeParse({ kind: 'event', title: 'Planning day' }).success).toBe(false)
    expect(createItemSchema.safeParse({ kind: 'task', title: 'Prepare summary' }).success).toBe(false)
  })

  it('rejects invalid quick-link URLs', () => {
    const result = createItemSchema.safeParse({ kind: 'link', title: 'Handbook', url: 'not-a-url' })
    expect(result.success).toBe(false)
  })
})

describe('member profile validation', () => {
  it('requires an organisation for profiles and invitations', () => {
    expect(memberProfileSchema.safeParse({ name: 'Jan Baloglu', organization: '', jobTitle: '', phone: '' }).success).toBe(false)
    expect(memberInvitationSchema.safeParse({ name: 'Casey Nguyen', email: 'casey@example.com', organization: 'Horizon School', jobTitle: 'Principal', role: 'admin' }).success).toBe(true)
    expect(memberInvitationSchema.safeParse({ name: 'Casey Nguyen', email: 'casey@example.com', organization: 'Horizon School', jobTitle: 'Principal', role: 'owner' }).success).toBe(false)
  })
})

describe('validateUpload', () => {
  it('accepts approved office files under 50 MB', () => {
    const file = new File(['report'], 'report.pdf', { type: 'application/pdf' })
    expect(validateUpload(file)).toBeNull()
  })

  it('rejects unsupported types', () => {
    const file = new File(['binary'], 'app.exe', { type: 'application/x-msdownload' })
    expect(validateUpload(file)).toMatch(/not supported/i)
  })

  it('rejects files larger than 50 MB', () => {
    const file = { name: 'huge.pdf', size: MAX_FILE_BYTES + 1, type: 'application/pdf' } as File
    expect(validateUpload(file)).toMatch(/50 MB/i)
  })
})
