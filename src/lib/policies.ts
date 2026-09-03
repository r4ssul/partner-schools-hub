import type { Member, MemberRole } from '../types'

export const TRASH_RETENTION_DAYS = 30

export function canManageMembership(role: MemberRole) {
  return role === 'owner'
}

export function canViewAuditLog(role: MemberRole) {
  return role === 'owner' || role === 'super_admin'
}

export const canClearAuditLog = canViewAuditLog

export function memberRoleLabel(role: MemberRole) {
  if (role === 'owner') return 'Owner'
  if (role === 'super_admin') return 'Super Admin'
  return 'Admin'
}

export function canDeactivateMember(actorRole: MemberRole, target: Member, members: Member[]) {
  if (!canManageMembership(actorRole) || !target.active) return false
  if (target.role !== 'owner') return true
  return members.filter((member) => member.active && member.role === 'owner').length > 1
}

export function isTrashExpired(deletedAt: string, now = new Date(), retentionDays = TRASH_RETENTION_DAYS) {
  const deletedTime = new Date(deletedAt).getTime()
  if (!Number.isFinite(deletedTime)) return true
  return now.getTime() - deletedTime >= retentionDays * 24 * 60 * 60 * 1000
}

export function notificationDedupeKey(kind: string, entityId: string, userId: string, scheduledFor: string) {
  return [kind.trim().toLowerCase(), entityId, userId, new Date(scheduledFor).toISOString()].join(':')
}
