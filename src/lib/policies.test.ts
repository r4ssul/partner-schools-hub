import { describe, expect, it } from 'vitest'
import { canClearAuditLog, canDeactivateMember, canManageMembership, canViewAuditLog, isTrashExpired, memberRoleLabel, notificationDedupeKey } from './policies'
import type { Member } from '../types'

const owner: Member = { id: 'owner', name: 'Owner', email: 'owner@example.com', organization: 'Partner School A', jobTitle: 'Head', phone: '', role: 'owner', color: '#000', active: true }
const admin: Member = { id: 'admin', name: 'Admin', email: 'admin@example.com', organization: 'Partner School B', jobTitle: 'Coordinator', phone: '', role: 'admin', color: '#000', active: true }
const superAdmin: Member = { ...admin, id: 'super-admin', name: 'Super Admin', role: 'super_admin' }

describe('membership permissions', () => {
  it('reserves membership management for owners', () => {
    expect(canManageMembership('owner')).toBe(true)
    expect(canManageMembership('super_admin')).toBe(false)
    expect(canManageMembership('admin')).toBe(false)
  })

  it('allows owners and super admins to review and clear logs', () => {
    expect(canViewAuditLog('owner')).toBe(true)
    expect(canViewAuditLog('super_admin')).toBe(true)
    expect(canViewAuditLog('admin')).toBe(false)
    expect(canClearAuditLog('owner')).toBe(true)
    expect(canClearAuditLog('super_admin')).toBe(true)
    expect(memberRoleLabel('owner')).toBe('Owner')
    expect(memberRoleLabel('super_admin')).toBe('Super Admin')
  })

  it('protects the final active owner', () => {
    expect(canDeactivateMember('owner', owner, [owner, admin])).toBe(false)
    expect(canDeactivateMember('owner', admin, [owner, admin])).toBe(true)
    expect(canDeactivateMember('owner', superAdmin, [owner, superAdmin])).toBe(true)
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
