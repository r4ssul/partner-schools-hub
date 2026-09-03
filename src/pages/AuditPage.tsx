import { useMemo, useState } from 'react'
import { Activity, CalendarClock, LoaderCircle, ShieldAlert, Trash2, UsersRound } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { Modal } from '../components/Modal'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { canClearAuditLog } from '../lib/policies'
import { formatDateTime } from '../lib/date'

type LogScope = 'activity' | 'members'

export default function AuditPage() {
  const { data, currentUser, clearAuditLog } = useWorkspace()
  const [view, setView] = useState<LogScope>('activity')
  const [confirmScope, setConfirmScope] = useState<LogScope | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [clearing, setClearing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const entries = useMemo(() => data.audit.filter((entry) => view === 'members' ? entry.entityKind === 'member' : entry.entityKind !== 'member'), [data.audit, view])

  const closeConfirm = () => {
    if (clearing) return
    setConfirmScope(null)
    setConfirmText('')
  }

  const clearLog = async () => {
    if (!confirmScope || confirmText !== 'CLEAR') return
    setClearing(true)
    const result = await clearAuditLog(confirmScope)
    setClearing(false)
    if (result.error) {
      setMessage(result.error)
      return
    }
    const label = confirmScope === 'members' ? 'member' : 'activity'
    setMessage(`${result.deleted} ${label} log ${result.deleted === 1 ? 'entry' : 'entries'} cleared.`)
    closeConfirm()
  }

  return (
    <div className="page feature-page">
      <div className="page-heading"><div><h1>Audit log</h1><p>Review workspace activity and team-access changes.</p></div></div>
      {message ? <div className={message.includes('cleared') ? 'toast-message is-success' : 'toast-message'} role="status">{message}<button onClick={() => setMessage(null)}>Dismiss</button></div> : null}
      <section className="content-surface">
        <div className="surface-toolbar audit-toolbar">
          <div><h2>{view === 'members' ? 'Member log' : 'Workspace activity'}</h2><span>{entries.length} recorded actions</span></div>
          <div className="segmented-control" aria-label="Audit log view"><button className={view === 'activity' ? 'is-active' : ''} onClick={() => setView('activity')}><Activity size={16} /> Activity</button><button className={view === 'members' ? 'is-active' : ''} onClick={() => setView('members')}><UsersRound size={16} /> Members</button></div>
        </div>
        {entries.length ? <div className="audit-list">{entries.map((entry) => {
          const actor = data.members.find((member) => member.id === entry.actorId) ?? currentUser
          return <div key={entry.id}><Avatar member={actor} size="sm" /><span><strong>{actor.name} {entry.action} {entry.entityName}</strong><small>{entry.entityKind}</small></span><time><CalendarClock size={15} />{formatDateTime(entry.createdAt)}</time></div>
        })}</div> : <div className="empty-state"><Activity size={36} /><h3>No {view === 'members' ? 'member changes' : 'activity'} recorded</h3><p>New {view === 'members' ? 'invitations and access changes' : 'workspace actions'} will appear here.</p></div>}
      </section>
      {canClearAuditLog(currentUser.role) ? <section className="content-surface audit-controls">
        <header><ShieldAlert size={23} /><div><h2>Log controls</h2><p>Available only to the Owner. Cleared history cannot be restored.</p></div></header>
        <div className="audit-control-grid">
          <div><span className="audit-control-icon"><Trash2 size={19} /></span><span><strong>Clear activity log</strong><small>Remove file, folder, event, meeting, task, and link history.</small></span><button className="button button--danger button--small" onClick={() => { setConfirmScope('activity'); setConfirmText('') }}>Clear activity</button></div>
          <div><span className="audit-control-icon"><Trash2 size={19} /></span><span><strong>Clear member log</strong><small>Remove invitation, role, and account-status history.</small></span><button className="button button--danger button--small" onClick={() => { setConfirmScope('members'); setConfirmText('') }}>Clear member log</button></div>
        </div>
      </section> : <p className="field-help">Only the Owner can clear activity and member logs.</p>}
      <Modal open={Boolean(confirmScope)} title={`Clear ${confirmScope === 'members' ? 'member' : 'activity'} log?`} description="This permanently removes the selected history for everyone in the workspace." onClose={closeConfirm} size="sm">
        <div className="confirm-dialog destructive-confirm"><p>Type <strong>CLEAR</strong> to confirm. This action cannot be undone.</p><label className="field"><span>Confirmation</span><input value={confirmText} onChange={(event) => setConfirmText(event.target.value.toUpperCase())} autoComplete="off" autoFocus /></label><div className="modal-footer"><button className="button button--secondary" onClick={closeConfirm} disabled={clearing}>Cancel</button><button className="button button--danger" onClick={() => void clearLog()} disabled={confirmText !== 'CLEAR' || clearing}>{clearing ? <><LoaderCircle className="spin" size={17} /> Clearing</> : <><Trash2 size={17} /> Clear permanently</>}</button></div></div>
      </Modal>
    </div>
  )
}
