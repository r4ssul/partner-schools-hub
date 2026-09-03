import { describe, expect, it } from 'vitest'
import { createInitialWorkspaceData } from './seed'

describe('production bootstrap workspace', () => {
  it('starts with two equal Super Admins and only Rassul can clear logs', () => {
    const data = createInitialWorkspaceData()
    expect(data.members.filter((member) => member.role === 'super_admin')).toHaveLength(2)
    expect(data.members[0].name).toBe('Jan Baloglu')
    expect(data.members[0].email).toBe('mcanbaloglu@enishi.ac.jp')
    expect(data.members[0]).toMatchObject({ organization: 'Enishi International School', role: 'super_admin', phone: '', canClearLogs: false })
    expect(data.members[1]).toMatchObject({ email: 'rassul.abzhapparov@enishi.ac.jp', role: 'super_admin', canClearLogs: true })
    expect(data.documents).toEqual([])
    expect(data.events).toEqual([])
    expect(data.meetings).toEqual([])
    expect(data.tasks).toEqual([])
    expect(data.links).toEqual([])
    expect(data.notifications).toEqual([])
    expect(data.audit).toEqual([])
  })

  it('uses the selected company timezone', () => {
    expect(createInitialWorkspaceData().settings.timezone).toBe('Asia/Tokyo')
  })
})
