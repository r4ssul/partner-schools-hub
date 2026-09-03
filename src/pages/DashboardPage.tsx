import { useState } from 'react'
import { CalendarDays, CheckSquare2, ChevronRight, Clock3, Folder, FolderPlus, Link2, LockKeyhole, MoreHorizontal, Plus, Upload, UsersRound } from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import { isSameDay, isTomorrow, isToday, parseISO } from 'date-fns'
import { Avatar } from '../components/Avatar'
import { FileGlyph } from '../components/FileGlyph'
import { Panel } from '../components/Panel'
import { StatusSelect } from '../components/StatusSelect'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { formatDate, formatTime } from '../lib/date'
import type { EntityKind, HubEvent, Meeting, Task } from '../types'

interface OutletActions { openCreate: (kind: EntityKind) => void }

function MemberAvatar({ id }: { id: string }) {
  const { data } = useWorkspace()
  const member = data.members.find((candidate) => candidate.id === id) ?? data.members[0]
  return <Avatar member={member} size="sm" />
}

function dateLabel(event: HubEvent) {
  const date = parseISO(event.startsAt)
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return formatDate(event.startsAt, { weekday: 'short', month: 'short', day: 'numeric' })
}

function ComingUp({ events, tasks }: { events: HubEvent[]; tasks: Task[] }) {
  const { updateTaskStatus } = useWorkspace()
  const [view, setView] = useState<'agenda' | 'tasks'>('agenda')
  const openTasks = tasks.filter((task) => task.status !== 'done')
  return (
    <Panel title="Coming up" icon={CalendarDays} className="dashboard-coming">
      <div className="subtabs" role="tablist" aria-label="Coming up view"><button role="tab" aria-selected={view === 'agenda'} className={view === 'agenda' ? 'is-active' : ''} onClick={() => setView('agenda')}>Agenda</button><button role="tab" aria-selected={view === 'tasks'} className={view === 'tasks' ? 'is-active' : ''} onClick={() => setView('tasks')}>Tasks ({openTasks.length})</button></div>
      <div className="agenda-list">
        {view === 'agenda' ? (events.length ? events.slice(0, 4).map((event, index) => (
          <div className="agenda-row" key={event.id}>
            {(index === 0 || !isSameDay(parseISO(events[index - 1].startsAt), parseISO(event.startsAt))) ? <div className="agenda-date">{dateLabel(event)} · {formatDate(event.startsAt, { month: 'short', day: 'numeric' })}</div> : null}
            <div className="agenda-row__content"><span className="event-dot" /><time>{formatTime(event.startsAt)}<small>– {formatTime(event.endsAt)}</small></time><span className="event-rule" /><div><strong>{event.title}</strong><small>{event.location}</small></div><MemberAvatar id={event.attendeeIds.at(-1) || event.createdBy} /></div>
          </div>
        )) : <div className="dashboard-empty"><CalendarDays size={28} /><strong>No events yet</strong><span>Schedule the first shared event.</span></div>) : (openTasks.length ? <div className="dashboard-task-list">{openTasks.slice(0, 5).map((task) => <div className="dashboard-task-row" key={task.id}><button className={`task-check task-check--${task.status}`} onClick={() => void updateTaskStatus(task.id, 'done')} aria-label={`Complete ${task.title}`} /><span><strong>{task.title}</strong><small>Due {formatDate(task.dueAt, { month: 'short', day: 'numeric' })}</small></span><MemberAvatar id={task.assigneeId} /></div>)}</div> : <div className="dashboard-empty"><CheckSquare2 size={28} /><strong>No open tasks</strong><span>New assignments will appear here.</span></div>)}
      </div>
      <Link className="panel-link" to={view === 'agenda' ? '/calendar' : '/tasks'}>{view === 'agenda' ? 'Open full calendar' : 'View all tasks'} <ChevronRight size={16} /></Link>
    </Panel>
  )
}

function FilesPanel({ openCreate }: { openCreate: (kind: EntityKind) => void }) {
  const { data } = useWorkspace()
  const documents = data.documents.filter((document) => !document.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
  return (
    <Panel title="Files & knowledge" icon={Folder} className="dashboard-files" action={<><button className="button button--secondary button--small" onClick={() => openCreate('file')}><Upload size={16} /> Upload</button><button className="icon-button icon-button--border" onClick={() => openCreate('folder')} aria-label="Create folder" title="Create folder"><FolderPlus size={18} /></button></>}>
      <div className="folder-strip">{data.folders.filter((folder) => !folder.deletedAt).slice(0, 6).map((folder) => <Link key={folder.id} to={`/files?folder=${folder.id}`}><Folder size={15} />{folder.name}</Link>)}</div>
      <div className="file-table file-table--compact">{documents.length ? <><div className="file-table__header"><span>Name</span><span>Owner</span><span>Updated</span><span /></div>{documents.map((document) => { const version = document.versions.at(-1)!; const owner = data.members.find((member) => member.id === document.ownerId) ?? data.members[0]; return <div className="file-row" key={document.id}><span className="file-name"><FileGlyph mimeType={version.mimeType} /><strong>{document.name}</strong></span><span>{owner.name}</span><span>{formatDate(document.updatedAt)}</span><button className="icon-button" aria-label={`Actions for ${document.name}`}><MoreHorizontal size={17} /></button></div> })}</> : <div className="dashboard-empty"><Folder size={28} /><strong>No files yet</strong><span>Upload the first shared resource.</span></div>}</div>
      <Link className="panel-link" to="/files">View all files <ChevronRight size={16} /></Link>
    </Panel>
  )
}

function QuickLinksPanel() {
  const { data } = useWorkspace()
  return (
    <Panel title="Quick links" icon={Link2} className="dashboard-links">
      <div className="quick-link-list">{data.links.some((link) => !link.deletedAt) ? data.links.filter((link) => !link.deletedAt).slice(0, 6).map((link) => <a key={link.id} href={link.url} target="_blank" rel="noreferrer"><span>{link.title}</span><ChevronRight size={17} /></a>) : <div className="dashboard-empty"><Link2 size={28} /><strong>No links yet</strong><span>Add frequently used school resources.</span></div>}</div>
      <Link className="panel-link" to="/links">Manage links <ChevronRight size={16} /></Link>
    </Panel>
  )
}

function TeamCalendar({ events }: { events: HubEvent[] }) {
  return (
    <Panel title="Team calendar" icon={CalendarDays} className="dashboard-calendar">
      <div className="mini-calendar-heading"><span className="date-chip">Today</span><strong>{formatDate(events[0]?.startsAt ?? new Date().toISOString(), { month: 'short', day: 'numeric' })}</strong></div>
      <div className="mini-calendar-list">{events.length ? events.slice(0, 5).map((event) => <div key={event.id}><time><strong>{formatDate(event.startsAt, { weekday: 'short' }).slice(0, 3)}</strong><span>{formatDate(event.startsAt, { day: 'numeric' })}</span></time><span className="event-dot" /><small>{formatTime(event.startsAt)}</small><strong>{event.title}</strong></div>) : <div className="dashboard-empty"><CalendarDays size={25} /><strong>Calendar is clear</strong><span>New events will appear here.</span></div>}</div>
      <Link className="panel-link" to="/calendar">Open full calendar <ChevronRight size={16} /></Link>
    </Panel>
  )
}

function MeetingsPanel({ meetings, tasks, openCreate }: { meetings: Meeting[]; tasks: Task[]; openCreate: (kind: EntityKind) => void }) {
  const [view, setView] = useState<'agenda' | 'minutes' | 'actions'>('agenda')
  const meetingMinutes = meetings.filter((meeting) => meeting.minutes.trim())
  const actionItems = tasks.filter((task) => task.sourceMeetingId && task.status !== 'done')
  return (
    <Panel title="Meetings" icon={UsersRound} className="dashboard-meetings" action={<button className="button button--secondary button--small" onClick={() => openCreate('meeting')}><Plus size={16} /> New meeting</button>}>
      <div className="subtabs" role="tablist" aria-label="Meeting overview"><button role="tab" aria-selected={view === 'agenda'} className={view === 'agenda' ? 'is-active' : ''} onClick={() => setView('agenda')}>Agenda</button><button role="tab" aria-selected={view === 'minutes'} className={view === 'minutes' ? 'is-active' : ''} onClick={() => setView('minutes')}>Minutes</button><button role="tab" aria-selected={view === 'actions'} className={view === 'actions' ? 'is-active' : ''} onClick={() => setView('actions')}>Action items</button></div>
      <div className="meeting-list">{view === 'agenda' ? (meetings.length ? meetings.slice(0, 3).map((meeting) => <Link to="/meetings" key={meeting.id}><div><strong>{meeting.title}</strong><span><Clock3 size={14} /> {formatDate(meeting.startsAt, { month: 'short', day: 'numeric' })}, {formatTime(meeting.startsAt)}</span></div><span className={`meeting-state meeting-state--${meeting.status}`}>{meeting.status.replace('_', ' ')}</span><ChevronRight size={17} /></Link>) : <div className="dashboard-empty"><UsersRound size={26} /><strong>No meetings yet</strong><span>Create an agenda when you are ready.</span></div>) : view === 'minutes' ? (meetingMinutes.length ? meetingMinutes.slice(0, 3).map((meeting) => <Link className="meeting-list__summary" to="/meetings" key={meeting.id}><div><strong>{meeting.title}</strong><span>{meeting.minutes}</span></div><ChevronRight size={17} /></Link>) : <div className="dashboard-empty"><Clock3 size={26} /><strong>No minutes yet</strong><span>Saved meeting notes will appear here.</span></div>) : (actionItems.length ? actionItems.slice(0, 3).map((task) => <Link className="meeting-list__summary" to="/tasks" key={task.id}><div><strong>{task.title}</strong><span>Due {formatDate(task.dueAt, { month: 'short', day: 'numeric' })}</span></div><ChevronRight size={17} /></Link>) : <div className="dashboard-empty"><CheckSquare2 size={26} /><strong>No action items</strong><span>Meeting follow-ups will appear here.</span></div>)}</div>
      <Link className="panel-link" to={view === 'actions' ? '/tasks' : '/meetings'}>{view === 'actions' ? 'View all tasks' : 'View all meetings'} <ChevronRight size={16} /></Link>
    </Panel>
  )
}

function TasksPanel({ tasks, openCreate }: { tasks: Task[]; openCreate: (kind: EntityKind) => void }) {
  const { updateTaskStatus } = useWorkspace()
  return (
    <Panel title="My tasks" icon={CheckSquare2} className="dashboard-tasks" action={<button className="button button--secondary button--small" onClick={() => openCreate('task')}><Plus size={16} /> Add task</button>}>
      <div className="task-table task-table--compact">{tasks.length ? <><div className="task-table__header"><span>Task</span><span>Assignee</span><span>Due</span><span>Status</span></div>{tasks.slice(0, 5).map((task) => <div className={task.status === 'done' ? 'task-row is-done' : 'task-row'} key={task.id}><button className={`task-check task-check--${task.status}`} onClick={() => void updateTaskStatus(task.id, task.status === 'done' ? 'to_do' : 'done')} aria-label={`${task.status === 'done' ? 'Reopen' : 'Complete'} ${task.title}`}>{task.status === 'done' ? '✓' : ''}</button><strong>{task.title}</strong><MemberAvatar id={task.assigneeId} /><span>{formatDate(task.dueAt, { month: 'short', day: 'numeric' })}</span><StatusSelect compact value={task.status} onChange={(status) => void updateTaskStatus(task.id, status)} /></div>)}</> : <div className="dashboard-empty"><CheckSquare2 size={28} /><strong>No tasks yet</strong><span>Create the first team follow-up.</span></div>}</div>
      <Link className="panel-link" to="/tasks">View all tasks <ChevronRight size={16} /></Link>
    </Panel>
  )
}

function SecureAccess() {
  return <Panel title="Secure access" icon={LockKeyhole} className="dashboard-security"><p>This is an internal portal for authorized team members only.</p><p>All activity is protected and recorded.</p><Link className="panel-link" to="/settings">Learn more <ChevronRight size={16} /></Link></Panel>
}

export default function DashboardPage() {
  const { data, currentUser } = useWorkspace()
  const { openCreate } = useOutletContext<OutletActions>()
  const events = data.events.filter((event) => !event.deletedAt).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const meetings = data.meetings.filter((meeting) => !meeting.deletedAt).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const tasks = data.tasks.filter((task) => !task.deletedAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  return (
    <div className="page dashboard-page">
      <div className="page-heading dashboard-heading"><div><h1>Good morning, {currentUser.name.split(' ')[0]}</h1></div><button className="button button--primary mobile-add-button" onClick={() => openCreate('task')}><Plus size={19} /> Add new</button></div>
      <div className="dashboard-grid">
        <ComingUp events={events} tasks={tasks} />
        <FilesPanel openCreate={openCreate} />
        <QuickLinksPanel />
        <TeamCalendar events={events} />
        <MeetingsPanel meetings={meetings} tasks={tasks} openCreate={openCreate} />
        <TasksPanel tasks={tasks} openCreate={openCreate} />
        <SecureAccess />
      </div>
    </div>
  )
}
