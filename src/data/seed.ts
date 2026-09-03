import type { WorkspaceData } from '../types'
import { PRIMARY_OWNER_EMAIL } from '../lib/identity'

const SUPER_ADMIN_ID = 'jan-baloglu'

export function createInitialWorkspaceData(): WorkspaceData {
  const now = new Date().toISOString()
  return {
    version: 3,
    members: [
      {
        id: SUPER_ADMIN_ID,
        name: 'Jan Baloglu',
        email: PRIMARY_OWNER_EMAIL,
        organization: '',
        jobTitle: '',
        phone: '',
        role: 'owner',
        color: '#0b6b6d',
        active: true,
      },
    ],
    settings: { name: 'Partner Schools Hub', timezone: 'Asia/Tokyo', emailNotifications: true },
    folders: [
      ['early-years', 'Early Years'],
      ['pyp', 'PYP'],
      ['myp', 'MYP'],
      ['dp', 'DP'],
      ['safeguarding', 'Safeguarding'],
      ['marketing-admissions', 'Marketing & Admissions'],
      ['student-support', 'Student Support'],
      ['it-ai', 'IT / AI'],
      ['meeting-minutes', 'Meeting Minutes'],
    ].map(([id, name]) => ({ id, name, parentId: null, createdAt: now, updatedAt: now, deletedAt: null })),
    documents: [],
    events: [],
    meetings: [],
    tasks: [],
    links: [],
    notifications: [],
    audit: [],
  }
}
