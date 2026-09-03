import { RotateCcw, Trash2 } from 'lucide-react'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { formatDateTime } from '../lib/date'

export default function TrashPage() {
  const { trash, restoreItem } = useWorkspace()
  return (
    <div className="page feature-page">
      <div className="page-heading"><div><h1>Trash</h1><p>Archived content is retained for 30 days before permanent removal.</p></div></div>
      <section className="content-surface"><div className="surface-toolbar"><div><h2>Recently deleted</h2><span>{trash.length} items</span></div><Trash2 size={22} /></div>{trash.length ? <div className="trash-list">{trash.map((item) => <div key={`${item.kind}-${item.id}`}><span className="trash-icon"><Trash2 size={18} /></span><span><strong>{item.name}</strong><small>{item.kind} · Deleted {formatDateTime(item.deletedAt)}</small></span><button className="button button--secondary button--small" onClick={() => void restoreItem(item.kind, item.id)}><RotateCcw size={16} /> Restore</button></div>)}</div> : <div className="empty-state"><Trash2 size={36} /><h3>Trash is empty</h3><p>Deleted content will appear here for 30 days.</p></div>}</section>
    </div>
  )
}
