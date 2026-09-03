/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { addHours } from 'date-fns'
import { createInitialWorkspaceData } from '../data/seed'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { isR2FileApiConfigured, uploadFileToR2 } from '../lib/fileApi'
import { canClearAuditLog, canDeactivateMember, canManageMembership, canViewAuditLog, isTrashExpired } from '../lib/policies'
import { validateUpload } from '../lib/validation'
import { fromTokyoInput } from '../lib/date'
import { INITIAL_SUPER_ADMIN_EMAIL } from '../lib/identity'
import type {
  AuditEntry,
  EntityKind,
  HubDocument,
  InvitableMemberRole,
  Member,
  MemberProfileInput,
  NewItemInput,
  TaskStatus,
  TrashItem,
  WorkspaceData,
} from '../types'
import { useAuth } from './AuthContext'

const STORAGE_KEY = 'partner-schools-hub:workspace:v3'
const PREVIOUS_STORAGE_KEY = 'partner-schools-hub:workspace:v2'
const LEGACY_STORAGE_KEYS = ['company-hub:workspace:v1', 'partner-schools-hub:workspace:v1']

interface WorkspaceContextValue {
  data: WorkspaceData
  workspaceId: number | null
  currentUser: Member
  loading: boolean
  error: string | null
  uploadUrls: Map<string, string>
  addItem: (input: NewItemInput) => Promise<void>
  uploadFile: (file: File, folderId?: string) => Promise<string | null>
  addDocumentVersion: (documentId: string, file: File) => Promise<string | null>
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<void>
  updateMeetingNotes: (meetingId: string, agenda: string, minutes: string) => Promise<void>
  archiveItem: (kind: EntityKind, id: string) => Promise<void>
  restoreItem: (kind: EntityKind, id: string) => Promise<void>
  markNotificationRead: (id: string) => Promise<void>
  updateSettings: (name: string, emailNotifications: boolean) => Promise<void>
  updateProfile: (profile: MemberProfileInput) => Promise<string | null>
  inviteMember: (name: string, email: string, organization: string, jobTitle: string, role: InvitableMemberRole) => Promise<string | null>
  deactivateMember: (memberId: string) => Promise<string | null>
  clearAuditLog: (scope: 'activity' | 'members') => Promise<{ error: string | null; deleted: number }>
  trash: TrashItem[]
  resetLocalPreview: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function loadLocalData() {
  try {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key))
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(PREVIOUS_STORAGE_KEY)
    if (!raw) return createInitialWorkspaceData()
    const parsed = JSON.parse(raw) as { version?: number }
    if (parsed.version !== 2 && parsed.version !== 3) return createInitialWorkspaceData()
    const workspace = parsed as unknown as WorkspaceData
    return {
      ...workspace,
      version: 3 as const,
      members: workspace.members.map((member) => ({ ...member, organization: member.organization ?? '', jobTitle: member.jobTitle ?? '', phone: member.phone ?? '' })),
    }
  } catch {
    return createInitialWorkspaceData()
  }
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`
}

function entityLabel(kind: EntityKind) {
  return kind === 'file' ? 'document' : kind
}

async function functionErrorMessage(reason: unknown, fallback: string) {
  const context = (reason as { context?: Response } | null)?.context
  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as { error?: string; message?: string }
      return body.error || body.message || fallback
    } catch {
      // Fall through to the standard error message.
    }
  }
  return reason instanceof Error ? reason.message : fallback
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<WorkspaceData>(loadLocalData)
  const [loading, setLoading] = useState(Boolean(supabase && user))
  const [error, setError] = useState<string | null>(null)
  const [uploadUrls, setUploadUrls] = useState(() => new Map<string, string>())
  const workspaceIdRef = useRef<number | null>(null)
  const [workspaceId, setWorkspaceId] = useState<number | null>(null)
  const refreshRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    if (!isSupabaseConfigured) localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (!supabase || !user) return
    const client = supabase
    let active = true
    let channel: RealtimeChannel | null = null

    async function loadRemote() {
      let membership = await client
        .from('workspace_members')
        .select('workspace_id, role')
        .eq('user_id', user!.id)
        .eq('active', true)
        .maybeSingle()
      if (!membership.error && !membership.data && user!.email.toLowerCase() === INITIAL_SUPER_ADMIN_EMAIL) {
        const bootstrap = await client.rpc('bootstrap_workspace', { workspace_name: 'Partner Schools Hub' })
        if (bootstrap.error) throw new Error(bootstrap.error.message)
        membership = await client
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', user!.id)
          .eq('active', true)
          .single()
      }
      if (membership.error || !membership.data) throw new Error(membership.error?.message || 'No active workspace membership')
      const workspaceId = Number(membership.data.workspace_id)
      workspaceIdRef.current = workspaceId
      const [workspace, profiles, folders, documents, events, meetings, tasks, links, notifications, audit] = await Promise.all([
        client.from('workspaces').select('name, timezone').eq('id', workspaceId).single(),
        client.from('workspace_members').select('user_id, role, can_clear_logs, active, joined_at, profiles(full_name,email,avatar_color,organization,job_title,phone)').eq('workspace_id', workspaceId),
        client.from('folders').select('*').eq('workspace_id', workspaceId),
        client.from('documents').select('*, document_versions(*)').eq('workspace_id', workspaceId),
        client.from('events').select('*, event_attendees(user_id)').eq('workspace_id', workspaceId),
        client.from('meetings').select('*, meeting_attendees(user_id)').eq('workspace_id', workspaceId),
        client.from('tasks').select('*, task_documents(document_id)').eq('workspace_id', workspaceId),
        client.from('quick_links').select('*').eq('workspace_id', workspaceId),
        client.from('notifications').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
        canViewAuditLog(membership.data.role)
          ? client.from('audit_log').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(100)
          : Promise.resolve({ data: [], error: null }),
      ])
      const firstError = [workspace, profiles, folders, documents, events, meetings, tasks, links, notifications, audit].find((result) => result.error)?.error
      if (firstError) throw new Error(firstError.message)
      if (!active) return
      setError(null)
      setWorkspaceId(workspaceId)

      const remoteMembers: Member[] = (profiles.data ?? []).map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        return {
          id: row.user_id,
          name: profile?.full_name || profile?.email || 'Team member',
          email: profile?.email || '',
          organization: profile?.organization || '',
          jobTitle: profile?.job_title || '',
          phone: profile?.phone || '',
          role: row.role,
          canClearLogs: row.can_clear_logs === true,
          color: profile?.avatar_color || '#0b6b6d',
          active: row.active,
          joinedAt: row.joined_at,
        }
      })
      const mapStamp = (value: string | null | undefined) => value || new Date().toISOString()
      setData({
        version: 3,
        members: remoteMembers,
        settings: { name: workspace.data!.name, timezone: workspace.data!.timezone, emailNotifications: true },
        folders: (folders.data ?? []).map((row) => ({ id: String(row.id), name: row.name, parentId: row.parent_id ? String(row.parent_id) : null, createdAt: mapStamp(row.created_at), updatedAt: mapStamp(row.updated_at), deletedAt: row.deleted_at })),
        documents: (documents.data ?? []).map((row) => ({ id: String(row.id), name: row.name, folderId: String(row.folder_id), ownerId: row.owner_id, updatedAt: mapStamp(row.updated_at), deletedAt: row.deleted_at, versions: (row.document_versions ?? []).map((version: { id: number; version_number: number; storage_path: string; size_bytes: number; mime_type: string; uploaded_by: string; created_at: string }) => ({ id: String(version.id), version: version.version_number, storagePath: version.storage_path, size: version.size_bytes, mimeType: version.mime_type, uploadedBy: version.uploaded_by, createdAt: version.created_at })) })),
        events: (events.data ?? []).map((row) => ({ id: String(row.id), title: row.title, description: row.description, startsAt: row.starts_at, endsAt: row.ends_at, location: row.location, attendeeIds: (row.event_attendees ?? []).map((attendee: { user_id: string }) => attendee.user_id), documentIds: row.document_ids?.map(String) ?? [], createdBy: row.created_by, updatedAt: mapStamp(row.updated_at), deletedAt: row.deleted_at })),
        meetings: (meetings.data ?? []).map((row) => ({ id: String(row.id), title: row.title, agenda: row.agenda, minutes: row.minutes, startsAt: row.starts_at, endsAt: row.ends_at, location: row.location, attendeeIds: (row.meeting_attendees ?? []).map((attendee: { user_id: string }) => attendee.user_id), documentIds: row.document_ids?.map(String) ?? [], status: row.status, createdBy: row.created_by, updatedAt: mapStamp(row.updated_at), deletedAt: row.deleted_at })),
        tasks: (tasks.data ?? []).map((row) => ({ id: String(row.id), title: row.title, assigneeId: row.assignee_id, dueAt: row.due_at, status: row.status, priority: row.priority, notes: row.notes, sourceMeetingId: row.source_meeting_id ? String(row.source_meeting_id) : null, sourceEventId: row.source_event_id ? String(row.source_event_id) : null, documentIds: (row.task_documents ?? []).map((document: { document_id: number }) => String(document.document_id)), createdBy: row.created_by, updatedAt: mapStamp(row.updated_at), deletedAt: row.deleted_at })),
        links: (links.data ?? []).map((row) => ({ id: String(row.id), title: row.title, url: row.url, description: row.description, category: row.category, createdBy: row.created_by, updatedAt: mapStamp(row.updated_at), deletedAt: row.deleted_at })),
        notifications: (notifications.data ?? []).map((row) => ({ id: String(row.id), title: row.title, body: row.body, createdAt: row.created_at, readAt: row.read_at })),
        audit: (audit.data ?? []).map((row) => ({ id: String(row.id), action: row.action, entityKind: row.entity_kind, entityName: row.entity_name, actorId: row.actor_id ?? null, createdAt: row.created_at })),
      })
    }

    const refresh = async () => {
      try { await loadRemote() } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : 'Unable to refresh the workspace') }
    }
    refreshRef.current = refresh
    void loadRemote().then(() => {
      const workspaceId = workspaceIdRef.current
      if (!workspaceId || !active) return
      channel = client.channel(`partner-schools-hub-${workspaceId}`)
      for (const table of ['folders', 'documents', 'document_versions', 'events', 'meetings', 'tasks', 'quick_links', 'notifications']) {
        channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `workspace_id=eq.${workspaceId}` }, () => { void refresh() })
      }
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` }, () => { void refresh() })
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { void refresh() })
      channel = channel.on('system', {}, (payload) => { if (payload.extension === 'postgres_changes' && payload.status === 'ok') void refresh() })
      void channel.subscribe()
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : 'Unable to load the workspace')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
      if (channel) void client.removeChannel(channel)
    }
  }, [user])

  const currentUser = useMemo(() => {
    return data.members.find((member) => member.id === user?.id) ?? data.members.find((member) => member.role === 'owner') ?? data.members[0]
  }, [data.members, user?.id])

  const addAudit = useCallback((draft: WorkspaceData, action: string, kind: EntityKind | 'member', name: string) => {
    const entry: AuditEntry = { id: createId('audit'), action, entityKind: kind, entityName: name, actorId: currentUser.id, createdAt: new Date().toISOString() }
    return { ...draft, audit: [entry, ...draft.audit] }
  }, [currentUser.id])

  const addItem = useCallback(async (input: NewItemInput) => {
    const now = new Date().toISOString()
    const start = input.startDate ? fromTokyoInput(input.startDate) : now
    const end = input.endDate ? fromTokyoInput(input.endDate) : addHours(new Date(start), 1).toISOString()
    const workspaceId = workspaceIdRef.current

    if (supabase) {
      if (!workspaceId) throw new Error('Workspace is not ready. Please try again.')
      const { error: createError } = await supabase.rpc('create_workspace_item', {
        target_workspace_id: workspaceId,
        item: { ...input, startDate: start, endDate: end, dueDate: input.dueDate ? fromTokyoInput(input.dueDate) : now },
      })
      if (createError) throw new Error(createError.message)
      await refreshRef.current()
      return
    }

    setData((previous) => {
      let next = previous
      const base = { id: createId(input.kind), createdBy: currentUser.id, updatedAt: now, deletedAt: null }
      if (input.kind === 'folder') {
        next = { ...previous, folders: [...previous.folders, { id: base.id, name: input.title, parentId: input.parentId ?? null, createdAt: now, updatedAt: now, deletedAt: null }] }
      } else if (input.kind === 'event') {
        next = { ...previous, events: [...previous.events, { ...base, title: input.title, description: input.description || '', startsAt: start, endsAt: end, location: input.location || '', attendeeIds: input.attendeeIds?.length ? input.attendeeIds : [currentUser.id], documentIds: input.documentIds ?? [] }] }
      } else if (input.kind === 'meeting') {
        next = { ...previous, meetings: [...previous.meetings, { ...base, title: input.title, agenda: input.description || '', minutes: '', startsAt: start, endsAt: end, location: input.location || '', attendeeIds: input.attendeeIds?.length ? input.attendeeIds : [currentUser.id], documentIds: input.documentIds ?? [], status: 'upcoming' }] }
      } else if (input.kind === 'task') {
        next = { ...previous, tasks: [...previous.tasks, { ...base, title: input.title, assigneeId: input.assigneeId || currentUser.id, dueAt: input.dueDate ? fromTokyoInput(input.dueDate) : now, status: 'to_do', priority: input.priority || 'medium', notes: input.description || '', sourceMeetingId: input.sourceMeetingId ?? null, sourceEventId: input.sourceEventId ?? null, documentIds: input.documentIds ?? [] }] }
      } else if (input.kind === 'link') {
        next = { ...previous, links: [...previous.links, { ...base, title: input.title, url: input.url || '#', description: input.description || '', category: input.category || 'General' }] }
      }
      return addAudit(next, 'created', input.kind, input.title)
    })
  }, [addAudit, currentUser.id])

  const uploadFile = useCallback(async (file: File, folderId?: string) => {
    const validationError = validateUpload(file)
    if (validationError) return validationError
    const targetFolderId = folderId ?? data.folders.find((folder) => !folder.deletedAt)?.id
    if (!targetFolderId) return 'Create a folder before uploading a file.'
    const now = new Date().toISOString()
    const workspaceId = workspaceIdRef.current
    let documentId = createId('file')
    let versionId = createId('version')
    let storagePath = `demo/${documentId}/${file.name}`

    if (supabase && workspaceId) {
      if (isR2FileApiConfigured) {
        const result = await uploadFileToR2(file, { workspaceId, folderId: Number(targetFolderId) })
        if (result.error || !result.data) return result.error || 'Unable to upload file.'
        documentId = String(result.data.documentId)
        versionId = String(result.data.versionId)
        storagePath = result.data.path
      } else {
        const { data: signed, error: signedError } = await supabase.functions.invoke('file-access', {
          body: { action: 'create-upload', workspaceId, folderId: Number(targetFolderId), fileName: file.name, mimeType: file.type, sizeBytes: file.size },
        })
        if (signedError) return signedError.message
        const { error: uploadError } = await supabase.storage.from('company-documents').uploadToSignedUrl(signed.path, signed.token, file)
        if (uploadError) return uploadError.message
        documentId = String(signed.documentId)
        versionId = String(signed.versionId)
        storagePath = signed.path
      }
    } else {
      setUploadUrls((previous) => new Map(previous).set(documentId, URL.createObjectURL(file)))
    }

    const document: HubDocument = {
      id: documentId,
      name: file.name,
      folderId: targetFolderId,
      ownerId: currentUser.id,
      updatedAt: now,
      deletedAt: null,
      versions: [{ id: versionId, version: 1, storagePath, size: file.size, mimeType: file.type, uploadedBy: currentUser.id, createdAt: now }],
    }
    setData((previous) => addAudit({ ...previous, documents: [document, ...previous.documents.filter((item) => item.id !== document.id)] }, 'uploaded', 'file', file.name))
    return null
  }, [addAudit, currentUser.id, data.folders])

  const addDocumentVersion = useCallback(async (documentId: string, file: File) => {
    const validationError = validateUpload(file)
    if (validationError) return validationError
    const existing = data.documents.find((document) => document.id === documentId)
    if (!existing) return 'Document not found.'
    const now = new Date().toISOString()
    let storagePath = `demo/${documentId}/${Date.now()}-${file.name}`
    let versionId = createId('version')
    const workspaceId = workspaceIdRef.current
    if (supabase && workspaceId) {
      if (isR2FileApiConfigured) {
        const result = await uploadFileToR2(file, { workspaceId, documentId: Number(documentId) })
        if (result.error || !result.data) return result.error || 'Unable to upload version.'
        storagePath = result.data.path
        versionId = String(result.data.versionId)
      } else {
        const { data: signed, error: signedError } = await supabase.functions.invoke('file-access', {
          body: { action: 'create-version', workspaceId, documentId: Number(documentId), fileName: file.name, mimeType: file.type, sizeBytes: file.size },
        })
        if (signedError) return signedError.message
        const { error: uploadError } = await supabase.storage.from('company-documents').uploadToSignedUrl(signed.path, signed.token, file)
        if (uploadError) return uploadError.message
        storagePath = signed.path
        versionId = String(signed.versionId)
      }
    } else {
      setUploadUrls((previous) => new Map(previous).set(documentId, URL.createObjectURL(file)))
    }
    setData((previous) => {
      const documents = previous.documents.map((document) => document.id === documentId ? {
        ...document,
        name: file.name,
        updatedAt: now,
        versions: [...document.versions, { id: versionId, version: document.versions.length + 1, storagePath, size: file.size, mimeType: file.type, uploadedBy: currentUser.id, createdAt: now }],
      } : document)
      return addAudit({ ...previous, documents }, 'added version', 'file', file.name)
    })
    return null
  }, [addAudit, currentUser.id, data.documents])

  const updateTaskStatus = useCallback(async (taskId: string, status: TaskStatus) => {
    if (supabase && workspaceIdRef.current) {
      const { error: updateError } = await supabase.from('tasks').update({ status }).eq('id', Number(taskId))
      if (updateError) throw updateError
    }
    setData((previous) => ({ ...previous, tasks: previous.tasks.map((task) => task.id === taskId ? { ...task, status, updatedAt: new Date().toISOString() } : task) }))
  }, [])

  const updateMeetingNotes = useCallback(async (meetingId: string, agenda: string, minutes: string) => {
    if (supabase && workspaceIdRef.current) {
      const { error: updateError } = await supabase.from('meetings').update({ agenda, minutes }).eq('id', Number(meetingId))
      if (updateError) throw updateError
    }
    setData((previous) => ({ ...previous, meetings: previous.meetings.map((meeting) => meeting.id === meetingId ? { ...meeting, agenda, minutes, updatedAt: new Date().toISOString() } : meeting) }))
  }, [])

  const archiveItem = useCallback(async (kind: EntityKind, id: string) => {
    const deletedAt = new Date().toISOString()
    const table = kind === 'file' ? 'documents' : kind === 'folder' ? 'folders' : kind === 'event' ? 'events' : kind === 'meeting' ? 'meetings' : kind === 'task' ? 'tasks' : 'quick_links'
    if (supabase && workspaceIdRef.current) {
      const { error: archiveError } = await supabase.from(table).update({ deleted_at: deletedAt }).eq('id', Number(id))
      if (archiveError) throw archiveError
    }
    setData((previous) => {
      const key = kind === 'file' ? 'documents' : kind === 'folder' ? 'folders' : kind === 'event' ? 'events' : kind === 'meeting' ? 'meetings' : kind === 'task' ? 'tasks' : 'links'
      const collection = previous[key] as Array<{ id: string; deletedAt: string | null }>
      return { ...previous, [key]: collection.map((item) => item.id === id ? { ...item, deletedAt } : item) }
    })
  }, [])

  const restoreItem = useCallback(async (kind: EntityKind, id: string) => {
    const table = kind === 'file' ? 'documents' : kind === 'folder' ? 'folders' : kind === 'event' ? 'events' : kind === 'meeting' ? 'meetings' : kind === 'task' ? 'tasks' : 'quick_links'
    if (supabase && workspaceIdRef.current) {
      const { error: restoreError } = await supabase.from(table).update({ deleted_at: null }).eq('id', Number(id))
      if (restoreError) throw restoreError
    }
    setData((previous) => {
      const key = kind === 'file' ? 'documents' : kind === 'folder' ? 'folders' : kind === 'event' ? 'events' : kind === 'meeting' ? 'meetings' : kind === 'task' ? 'tasks' : 'links'
      const collection = previous[key] as Array<{ id: string; deletedAt: string | null }>
      return { ...previous, [key]: collection.map((item) => item.id === id ? { ...item, deletedAt: null } : item) }
    })
  }, [])

  const markNotificationRead = useCallback(async (id: string) => {
    const readAt = new Date().toISOString()
    if (supabase && workspaceIdRef.current) await supabase.from('notifications').update({ read_at: readAt }).eq('id', Number(id))
    setData((previous) => ({ ...previous, notifications: previous.notifications.map((notification) => notification.id === id ? { ...notification, readAt } : notification) }))
  }, [])

  const updateSettings = useCallback(async (name: string, emailNotifications: boolean) => {
    if (supabase && workspaceIdRef.current) {
      const preferenceUpdate = supabase.from('notification_preferences').upsert({ workspace_id: workspaceIdRef.current, user_id: currentUser.id, email_enabled: emailNotifications }, { onConflict: 'workspace_id,user_id' })
      if (canManageMembership(currentUser.role)) {
        const workspaceUpdate = supabase.from('workspaces').update({ name }).eq('id', workspaceIdRef.current)
        const results = await Promise.all([preferenceUpdate, workspaceUpdate])
        const failure = results.find((result) => result.error)?.error
        if (failure) throw new Error(failure.message)
      } else {
        const result = await preferenceUpdate
        if (result.error) throw new Error(result.error.message)
      }
    }
    setData((previous) => ({ ...previous, settings: { ...previous.settings, name: canManageMembership(currentUser.role) ? name : previous.settings.name, emailNotifications } }))
  }, [currentUser.id, currentUser.role])

  const updateProfile = useCallback(async (profile: MemberProfileInput) => {
    if (supabase && workspaceIdRef.current) {
      const { error: profileError } = await supabase.from('profiles').update({
        full_name: profile.name,
        organization: profile.organization,
        job_title: profile.jobTitle,
        phone: profile.phone,
      }).eq('id', currentUser.id)
      if (profileError) return profileError.message
    }
    setData((previous) => ({
      ...previous,
      members: previous.members.map((member) => member.id === currentUser.id ? { ...member, ...profile } : member),
    }))
    return null
  }, [currentUser.id])

  const inviteMember = useCallback(async (name: string, email: string, organization: string, jobTitle: string, role: InvitableMemberRole) => {
    if (!canManageMembership(currentUser.role)) return 'Only Super Admins can invite people.'
    if (supabase && workspaceIdRef.current) {
      const { error: inviteError } = await supabase.functions.invoke('manage-members', { body: { action: 'invite', workspaceId: workspaceIdRef.current, name, email, organization, jobTitle, role } })
      return inviteError ? await functionErrorMessage(inviteError, 'Unable to send the invitation.') : null
    }
    const member: Member = { id: createId('member'), name, email, organization, jobTitle, phone: '', role, canClearLogs: false, color: '#477d5d', active: true, joinedAt: new Date().toISOString() }
    setData((previous) => addAudit({ ...previous, members: [...previous.members, member] }, 'invited', 'member', name))
    return null
  }, [addAudit, currentUser.role])

  const deactivateMember = useCallback(async (memberId: string) => {
    if (!canManageMembership(currentUser.role)) return 'Only Super Admins can deactivate people.'
    const member = data.members.find((candidate) => candidate.id === memberId)
    if (!member) return 'Member not found.'
    if (!canDeactivateMember(currentUser.role, member, data.members)) return 'Super Admins cannot be deactivated.'
    if (supabase && workspaceIdRef.current) {
      const { error: deactivateError } = await supabase.functions.invoke('manage-members', { body: { action: 'deactivate', workspaceId: workspaceIdRef.current, userId: memberId } })
      if (deactivateError) return deactivateError.message
    }
    setData((previous) => addAudit({ ...previous, members: previous.members.map((candidate) => candidate.id === memberId ? { ...candidate, active: false } : candidate) }, 'deactivated', 'member', member.name))
    return null
  }, [addAudit, currentUser.role, data.members])

  const clearAuditLog = useCallback(async (scope: 'activity' | 'members') => {
    if (!canClearAuditLog(currentUser)) return { error: 'Only Rassul has permission to clear logs.', deleted: 0 }
    let deleted = data.audit.filter((entry) => scope === 'members' ? entry.entityKind === 'member' : entry.entityKind !== 'member').length
    if (supabase && workspaceIdRef.current) {
      const { data: deletedRows, error: clearError } = await supabase.rpc('clear_workspace_log', {
        target_workspace_id: workspaceIdRef.current,
        target_scope: scope,
      })
      if (clearError) return { error: clearError.message, deleted: 0 }
      deleted = Number(deletedRows ?? 0)
    }
    setData((previous) => ({
      ...previous,
      audit: previous.audit.filter((entry) => scope === 'members' ? entry.entityKind !== 'member' : entry.entityKind === 'member'),
    }))
    return { error: null, deleted }
  }, [currentUser, data.audit])

  const trash = useMemo(() => {
    const items: TrashItem[] = []
    data.documents.forEach((item) => { if (item.deletedAt && !isTrashExpired(item.deletedAt)) items.push({ id: item.id, kind: 'file', name: item.name, deletedAt: item.deletedAt }) })
    data.folders.forEach((item) => { if (item.deletedAt && !isTrashExpired(item.deletedAt)) items.push({ id: item.id, kind: 'folder', name: item.name, deletedAt: item.deletedAt }) })
    data.events.forEach((item) => { if (item.deletedAt && !isTrashExpired(item.deletedAt)) items.push({ id: item.id, kind: 'event', name: item.title, deletedAt: item.deletedAt }) })
    data.meetings.forEach((item) => { if (item.deletedAt && !isTrashExpired(item.deletedAt)) items.push({ id: item.id, kind: 'meeting', name: item.title, deletedAt: item.deletedAt }) })
    data.tasks.forEach((item) => { if (item.deletedAt && !isTrashExpired(item.deletedAt)) items.push({ id: item.id, kind: 'task', name: item.title, deletedAt: item.deletedAt }) })
    data.links.forEach((item) => { if (item.deletedAt && !isTrashExpired(item.deletedAt)) items.push({ id: item.id, kind: 'link', name: item.title, deletedAt: item.deletedAt }) })
    return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  }, [data])

  const resetLocalPreview = useCallback(() => {
    const next = createInitialWorkspaceData()
    setData(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const value = useMemo(() => ({ data, workspaceId, currentUser, loading, error, uploadUrls, addItem, uploadFile, addDocumentVersion, updateTaskStatus, updateMeetingNotes, archiveItem, restoreItem, markNotificationRead, updateSettings, updateProfile, inviteMember, deactivateMember, clearAuditLog, trash, resetLocalPreview }), [data, workspaceId, currentUser, loading, error, uploadUrls, addItem, uploadFile, addDocumentVersion, updateTaskStatus, updateMeetingNotes, archiveItem, restoreItem, markNotificationRead, updateSettings, updateProfile, inviteMember, deactivateMember, clearAuditLog, trash, resetLocalPreview])

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider')
  return value
}

export function humanizeEntity(kind: EntityKind) {
  return entityLabel(kind)
}
