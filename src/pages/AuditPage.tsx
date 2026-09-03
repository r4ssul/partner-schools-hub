import { Activity, CalendarClock } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { formatDateTime } from '../lib/date'

export default function AuditPage() {
  const { data, currentUser } = useWorkspace()
  return (
    <div className="page feature-page">
      <div className="page-heading"><div><h1>Audit log</h1><p>A read-only history of important workspace activity.</p></div></div>
      <section className="content-surface"><div className="surface-toolbar"><div><h2>Recent activity</h2><span>{data.audit.length} recorded actions</span></div><Activity size={22} /></div>{data.audit.length ? <div className="audit-list">{data.audit.map((entry) => { const actor = data.members.find((member) => member.id === entry.actorId) ?? currentUser; return <div key={entry.id}><Avatar member={actor} size="sm" /><span><strong>{actor.name} {entry.action} {entry.entityName}</strong><small>{entry.entityKind}</small></span><time><CalendarClock size={15} />{formatDateTime(entry.createdAt)}</time></div> })}</div> : <div className="empty-state"><Activity size={36} /><h3>No activity recorded</h3></div>}</section>
    </div>
  )
}
