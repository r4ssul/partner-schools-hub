import { Activity, BellRing, Building2, Database, FileText, FolderOpen, Settings, ShieldCheck, Trash2, UserCog, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { isR2FileApiConfigured } from '../lib/fileApi'
import { isSupabaseConfigured } from '../lib/supabase'

export default function DeveloperPage() {
  const { data, trash } = useWorkspace()
  const activeMembers = data.members.filter((member) => member.active).length
  const activeFiles = data.documents.filter((file) => !file.deletedAt).length
  const activeSchedule = data.events.filter((event) => !event.deletedAt).length + data.meetings.filter((meeting) => !meeting.deletedAt).length
  return (
    <div className="page feature-page developer-page">
      <div className="page-heading"><div><h1>Website management</h1><p>Developer-only controls and a live overview of Partner Schools Hub.</p></div></div>
      <section className="developer-status-grid" aria-label="Website status">
        <div className="content-surface"><UsersRound /><span><strong>{activeMembers}</strong><small>Active members</small></span></div>
        <div className="content-surface"><FileText /><span><strong>{activeFiles}</strong><small>Shared files</small></span></div>
        <div className="content-surface"><Activity /><span><strong>{activeSchedule}</strong><small>Events and meetings</small></span></div>
        <div className="content-surface"><Trash2 /><span><strong>{trash.length}</strong><small>Items in trash</small></span></div>
      </section>
      <section className="content-surface developer-controls">
        <div className="surface-toolbar"><div><h2>Management controls</h2><span>Use these tools without changing code.</span></div><ShieldCheck size={22} /></div>
        <div className="developer-link-grid">
          <Link to="/settings"><Building2 /><span><strong>Workspace details</strong><small>Change the workspace name and notification preferences.</small></span></Link>
          <Link to="/team"><UserCog /><span><strong>Members and access</strong><small>Invite, deactivate, review, or remove former accounts.</small></span></Link>
          <Link to="/admin/audit"><Activity /><span><strong>Audit and logs</strong><small>Review activity or permanently clear selected or all logs.</small></span></Link>
          <Link to="/trash"><Trash2 /><span><strong>Deleted content</strong><small>Restore content during its 30-day recovery period.</small></span></Link>
        </div>
      </section>
      <section className="content-surface developer-system">
        <div className="surface-toolbar"><div><h2>Connected services</h2><span>Operational services used by this website.</span></div><Settings size={22} /></div>
        <div className="settings-status"><Database /><span><strong>{isSupabaseConfigured ? 'Database connected' : 'Database configuration required'}</strong><small>Accounts, calendar, tasks, messages, notifications and audit data.</small></span></div>
        <div className="settings-status"><FolderOpen /><span><strong>{isR2FileApiConfigured ? 'Cloudflare R2 connected' : 'File storage configuration required'}</strong><small>Private files and document versions.</small></span></div>
        <div className="settings-status"><BellRing /><span><strong>Email assignments are queued</strong><small>An external email provider is required for delivery; in-app notifications work independently.</small></span></div>
      </section>
    </div>
  )
}
