import { FORMER_MEMBER } from '../lib/policies'
import { useMemo, useState } from 'react'
import { CheckSquare2, Filter, Plus, Search, Trash2 } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { StatusSelect } from '../components/StatusSelect'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { formatDate } from '../lib/date'
import type { EntityKind, TaskStatus } from '../types'

interface OutletActions { openCreate: (kind: EntityKind) => void }

export default function TasksPage() {
  const { data, currentUser, updateTaskStatus, archiveItem } = useWorkspace()
  const { openCreate } = useOutletContext<OutletActions>()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<TaskStatus | 'all'>('all')
  const [mineOnly, setMineOnly] = useState(false)
  const tasks = useMemo(() => data.tasks.filter((task) => !task.deletedAt && (status === 'all' || task.status === status) && (!mineOnly || task.assigneeId === currentUser.id) && task.title.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.dueAt.localeCompare(b.dueAt)), [currentUser.id, data.tasks, mineOnly, query, status])

  return (
    <div className="page feature-page">
      <div className="page-heading"><div><h1>Tasks</h1><p>Simple, shared ownership for the work that moves the partnership forward.</p></div><button className="button button--primary" onClick={() => openCreate('task')}><Plus size={18} /> Add task</button></div>
      <section className="content-surface">
        <div className="surface-toolbar task-toolbar"><div className="segmented-control" aria-label="Filter by status">{(['all', 'to_do', 'in_progress', 'done'] as const).map((value) => <button aria-pressed={status === value} className={status === value ? 'is-active' : ''} key={value} onClick={() => setStatus(value)}>{value === 'all' ? 'All' : value.replace('_', ' ')}</button>)}</div><div className="toolbar-controls"><button aria-pressed={mineOnly} className={mineOnly ? 'button button--secondary button--small is-active' : 'button button--secondary button--small'} onClick={() => setMineOnly((value) => !value)}><Filter size={16} /> Assigned to me</button><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" aria-label="Search tasks" /></label></div></div>
        <div className="task-table task-table--full"><div className="task-table__header"><span>Task</span><span>Assignee</span><span>Priority</span><span>Due</span><span>Status</span><span /></div>{tasks.map((task) => { const assignee = data.members.find((member) => member.id === task.assigneeId) ?? { ...FORMER_MEMBER, name: 'Unassigned' }; return <div className={task.status === 'done' ? 'task-row is-done' : 'task-row'} key={task.id}><button className={`task-check task-check--${task.status}`} onClick={() => void updateTaskStatus(task.id, task.status === 'done' ? 'to_do' : 'done')} aria-label={`${task.status === 'done' ? 'Reopen' : 'Complete'} ${task.title}`}>{task.status === 'done' ? '✓' : ''}</button><span className="task-title"><strong>{task.title}</strong><small>{task.notes || 'No notes added'}</small></span><span className="assignee-cell"><Avatar member={assignee} size="sm" />{assignee.name}</span><span className={`priority priority--${task.priority}`}>{task.priority}</span><time>{formatDate(task.dueAt)}</time><StatusSelect value={task.status} onChange={(next) => void updateTaskStatus(task.id, next)} /><button className="icon-button" onClick={() => void archiveItem('task', task.id)} aria-label={`Move ${task.title} to trash`}><Trash2 size={17} /></button></div> })}{!tasks.length ? <div className="empty-state"><CheckSquare2 size={36} /><h3>No matching tasks</h3><p>Change the filters or create a new task.</p></div> : null}</div>
      </section>
    </div>
  )
}
