import type { Member, MemberRole } from '../types'
import { INITIAL_SUPER_ADMIN_EMAIL } from './identity'

export const TRASH_RETENTION_DAYS = 30

export function canManageMembership(role: MemberRole) {
  return role === 'owner' || role === 'super_admin'
}

export const canManageWorkspace = canManageMembership

export function canViewAuditLog(role: MemberRole) {
  return role === 'owner' || role === 'super_admin'
}

export function canClearAuditLog(member: Pick<Member, 'role' | 'active' | 'canClearLogs'>) {
  return member.active && canManageMembership(member.role) && member.canClearLogs === true
}

export function memberRoleLabel(role: MemberRole, email?: string) {
  // A presentation title, never an authorization check.
  if (email?.toLowerCase() === INITIAL_SUPER_ADMIN_EMAIL) return 'Web. Developer'
  if (role === 'owner') return 'Super Admin'
  if (role === 'super_admin') return 'Super Admin'
  return 'Admin'
}

export function canDeactivateMember(actorRole: MemberRole, target: Member, members: Member[]) {
  if (!canManageMembership(actorRole) || !target.active) return false
  return target.role === 'admin' && members.some((member) => member.active && canManageMembership(member.role))
}

export function isTrashExpired(deletedAt: string, now = new Date(), retentionDays = TRASH_RETENTION_DAYS) {
  const deletedTime = new Date(deletedAt).getTime()
  if (!Number.isFinite(deletedTime)) return true
  return now.getTime() - deletedTime >= retentionDays * 24 * 60 * 60 * 1000
}

export function notificationDedupeKey(kind: string, entityId: string, userId: string, scheduledFor: string) {
  return [kind.trim().toLowerCase(), entityId, userId, new Date(scheduledFor).toISOString()].join(':')
}
