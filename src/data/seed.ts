import type { WorkspaceData } from '../types'
import { INITIAL_SUPER_ADMIN_EMAIL, SUPER_ADMIN_EMAIL } from '../lib/identity'

const SUPER_ADMIN_ID = 'jan-baloglu'

export function createInitialWorkspaceData(): WorkspaceData {
  const now = new Date().toISOString()
  return {
    version: 3,
    members: [
      {
        id: SUPER_ADMIN_ID,
        name: 'Jan Baloglu',
        email: SUPER_ADMIN_EMAIL,
        organization: 'Enishi International School',
        jobTitle: 'Super Administrator',
        phone: '',
        role: 'super_admin',
        canClearLogs: false,
        color: '#0b6b6d',
        active: true,
      },
      { id: 'rassul-abzhapparov', name: 'Rassul Abzhapparov', email: INITIAL_SUPER_ADMIN_EMAIL, organization: 'Enishi International School', jobTitle: 'Web. Developer', phone: '', role: 'super_admin', canClearLogs: true, color: '#0b6b6d', active: true },
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
