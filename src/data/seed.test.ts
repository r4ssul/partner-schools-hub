import { describe, expect, it } from 'vitest'
import { createInitialWorkspaceData } from './seed'

describe('production bootstrap workspace', () => {
  it('starts with Jan Baloglu as the sole super administrator and no illustrative content', () => {
    const data = createInitialWorkspaceData()
    expect(data.members.filter((member) => member.role === 'owner')).toHaveLength(1)
    expect(data.members[0].name).toBe('Jan Baloglu')
    expect(data.members[0].email).toBe('mcanbaloglu@enishi.ac.jp')
    expect(data.members[0]).toMatchObject({ organization: 'Enishi International School', role: 'super_admin', phone: '' })
    expect(data.members[1]).toMatchObject({ email: 'rassul.abzhapparov@enishi.ac.jp', role: 'owner' })
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
