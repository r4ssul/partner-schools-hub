export type MemberRole = 'owner' | 'admin'
export type TaskStatus = 'to_do' | 'in_progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'
export type MeetingStatus = 'upcoming' | 'in_progress' | 'complete'
export type EntityKind = 'file' | 'folder' | 'event' | 'meeting' | 'task' | 'link'

export interface Member {
  id: string
  name: string
  email: string
  organization: string
  jobTitle: string
  phone: string
  role: MemberRole
  color: string
  active: boolean
}

export interface MemberProfileInput {
  name: string
  organization: string
  jobTitle: string
  phone: string
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface DocumentVersion {
  id: string
  version: number
  storagePath: string
  size: number
  mimeType: string
  uploadedBy: string
  createdAt: string
}

export interface HubDocument {
  id: string
  name: string
  folderId: string
  ownerId: string
  updatedAt: string
  deletedAt: string | null
  versions: DocumentVersion[]
}

export interface HubEvent {
  id: string
  title: string
  description: string
  startsAt: string
  endsAt: string
  location: string
  attendeeIds: string[]
  documentIds: string[]
  createdBy: string
  updatedAt: string
  deletedAt: string | null
}

export interface Meeting {
  id: string
  title: string
  agenda: string
  minutes: string
  startsAt: string
  endsAt: string
  location: string
  attendeeIds: string[]
  documentIds: string[]
  status: MeetingStatus
  createdBy: string
  updatedAt: string
  deletedAt: string | null
}

export interface Task {
  id: string
  title: string
  assigneeId: string
  dueAt: string
  status: TaskStatus
  priority: TaskPriority
  notes: string
  sourceMeetingId: string | null
  sourceEventId: string | null
  documentIds: string[]
  createdBy: string
  updatedAt: string
  deletedAt: string | null
}

export interface QuickLink {
  id: string
  title: string
  url: string
  description: string
  category: string
  createdBy: string
  updatedAt: string
  deletedAt: string | null
}

export interface HubNotification {
  id: string
  title: string
  body: string
  createdAt: string
  readAt: string | null
}

export interface AuditEntry {
  id: string
  action: string
  entityKind: EntityKind | 'member'
  entityName: string
  actorId: string
  createdAt: string
}

export interface WorkspaceSettings {
  name: string
  timezone: string
  emailNotifications: boolean
}

export interface WorkspaceData {
  version: 3
  members: Member[]
  folders: Folder[]
  documents: HubDocument[]
  events: HubEvent[]
  meetings: Meeting[]
  tasks: Task[]
  links: QuickLink[]
  notifications: HubNotification[]
  audit: AuditEntry[]
  settings: WorkspaceSettings
}

export interface NewItemInput {
  kind: EntityKind
  title: string
  description?: string
  startDate?: string
  endDate?: string
  location?: string
  assigneeId?: string
  priority?: TaskPriority
  dueDate?: string
  url?: string
  category?: string
  parentId?: string | null
  attendeeIds?: string[]
  documentIds?: string[]
  sourceMeetingId?: string | null
  sourceEventId?: string | null
}

export interface TrashItem {
  id: string
  kind: EntityKind
  name: string
  deletedAt: string
}
