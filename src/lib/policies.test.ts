import { describe, expect, it } from 'vitest'
import { ACCESS_MODEL_TEXT, canClearAuditLog, canDeactivateMember, canDeleteFormerMember, canManageMembership, canViewAuditLog, isTrashExpired, memberRoleLabel, notificationDedupeKey } from './policies'
import type { Member } from '../types'

const owner: Member = { id: 'rassul', name: 'Rassul', email: 'rassul@example.com', organization: 'Partner School A', jobTitle: 'Head', phone: '', role: 'super_admin', canClearLogs: true, color: '#000', active: true }
const admin: Member = { id: 'admin', name: 'Admin', email: 'admin@example.com', organization: 'Partner School B', jobTitle: 'Coordinator', phone: '', role: 'admin', canClearLogs: false, color: '#000', active: true }
const superAdmin: Member = { ...admin, id: 'super-admin', name: 'Super Admin', role: 'super_admin' }

describe('membership permissions', () => {
  it('allows only the active destructive-controls administrator to delete former Admins', () => {
    const former = { ...admin, active: false }
    expect(canDeleteFormerMember(owner, former)).toBe(true)
    expect(canDeleteFormerMember(superAdmin, former)).toBe(false)
    expect(canDeleteFormerMember(admin, former)).toBe(false)
    expect(canDeleteFormerMember(owner, admin)).toBe(false)
    expect(canDeleteFormerMember(owner, { ...superAdmin, active: false })).toBe(false)
    expect(canDeleteFormerMember({ ...owner, active: false }, former)).toBe(false)
    expect(canDeleteFormerMember(owner, { ...former, id: owner.id })).toBe(false)
  })

  it('uses the requested access-model wording exactly', () => {
    expect(ACCESS_MODEL_TEXT).toBe('Rassul (Web. Developer) and Jan (Super Admin) have the same management access to members, workspace settings, audit logs, and shared content. All other members are Admins and can manage shared content and use team chat.')
  })
  it('allows both leadership roles to manage membership', () => {
    expect(canManageMembership('owner')).toBe(true)
    expect(canManageMembership('super_admin')).toBe(true)
    expect(canManageMembership('admin')).toBe(false)
  })

  it('allows both Super Admins to review logs, but only the explicitly permitted member can clear them', () => {
    expect(canViewAuditLog('owner')).toBe(true)
    expect(canViewAuditLog('super_admin')).toBe(true)
    expect(canViewAuditLog('admin')).toBe(false)
    expect(canClearAuditLog(owner)).toBe(true)
    expect(canClearAuditLog(superAdmin)).toBe(false)
    expect(canClearAuditLog(admin)).toBe(false)
    expect(canClearAuditLog({ ...owner, active: false })).toBe(false)
    expect(canClearAuditLog({ ...admin, canClearLogs: true })).toBe(false)
    expect(memberRoleLabel('owner')).toBe('Super Admin')
    expect(memberRoleLabel('super_admin')).toBe('Super Admin')
    expect(memberRoleLabel('super_admin', 'rassul.abzhapparov@enishi.ac.jp')).toBe('Web. Developer')
    expect(memberRoleLabel('super_admin', 'mcanbaloglu@enishi.ac.jp')).toBe('Super Admin')
  })

  it('protects both Super Admins and permits either to manage Admin members', () => {
    expect(canDeactivateMember('owner', owner, [owner, admin])).toBe(false)
    expect(canDeactivateMember('owner', admin, [owner, admin])).toBe(true)
    expect(canDeactivateMember('owner', superAdmin, [owner, superAdmin])).toBe(false)
    expect(canDeactivateMember('super_admin', admin, [owner, superAdmin, admin])).toBe(true)
    expect(canDeactivateMember('admin', admin, [owner, admin])).toBe(false)
  })
})

describe('notification and trash lifecycle rules', () => {
  it('creates deterministic reminder deduplication keys', () => {
    const first = notificationDedupeKey('Task Due', '42', 'alex', '2026-09-03T08:00:00+09:00')
    const second = notificationDedupeKey('task due', '42', 'alex', '2026-09-02T23:00:00Z')
    expect(first).toBe(second)
  })

  it('expires trash at 30 days but not one millisecond earlier', () => {
    const now = new Date('2026-09-02T00:00:00Z')
    expect(isTrashExpired('2026-08-03T00:00:00Z', now)).toBe(true)
    expect(isTrashExpired('2026-08-03T00:00:00.001Z', now)).toBe(false)
  })
})
