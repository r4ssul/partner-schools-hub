import { FORMER_MEMBER } from '../lib/policies'
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
import { buildCalendarSchedule, type CalendarScheduleItem } from '../lib/calendar'
import type { EntityKind, Meeting, Task } from '../types'

interface OutletActions { openCreate: (kind: EntityKind) => void }

function MemberAvatar({ id }: { id: string | null }) {
  const { data } = useWorkspace()
  const member = data.members.find((candidate) => candidate.id === id) ?? FORMER_MEMBER
  return <Avatar member={member} size="sm" />
}

function dateLabel(event: CalendarScheduleItem) {
  const date = parseISO(event.startsAt)
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return formatDate(event.startsAt, { weekday: 'short', month: 'short', day: 'numeric' })
}

function SchedulePanel({ events, meetings, tasks, openCreate }: { events: CalendarScheduleItem[]; meetings: Meeting[]; tasks: Task[]; openCreate: (kind: EntityKind) => void }) {
  const [meetingView, setMeetingView] = useState<'agenda' | 'minutes' | 'actions'>('agenda')
  const meetingMinutes = meetings.filter((meeting) => meeting.minutes.trim())
  const actionItems = tasks.filter((task) => task.sourceMeetingId && task.status !== 'done')
  const sharedEventCount = events.filter((event) => event.kind === 'event').length
  const meetingCount = events.filter((event) => event.kind === 'meeting').length

  return (
    <Panel title="Schedule & meetings" icon={CalendarDays} className="dashboard-schedule" action={<><button className="button button--secondary button--small" onClick={() => openCreate('event')}><Plus size={16} /><span>New event</span></button><button className="button button--secondary button--small" onClick={() => openCreate('meeting')}><UsersRound size={16} /><span>New meeting</span></button></>}>
      <div className="schedule-summary" aria-label="Schedule summary">
        <span className="date-chip">Upcoming</span>
        <div className="schedule-legend"><span><i className="event-dot" /> {sharedEventCount} team {sharedEventCount === 1 ? 'event' : 'events'}</span><span><i className="event-dot event-dot--meeting" /> {meetingCount} team {meetingCount === 1 ? 'meeting' : 'meetings'}</span></div>
      </div>
      <div className="schedule-columns">
        <section className="schedule-column schedule-column--agenda" aria-labelledby="team-schedule-heading">
          <div className="schedule-section-heading"><div><h3 id="team-schedule-heading">Coming up</h3><p>All team events and meetings shared with you</p></div><Link to="/calendar">Calendar <ChevronRight size={15} /></Link></div>
          <div className="agenda-list">
            {events.length ? events.slice(0, 5).map((event, index) => (
              <div className="agenda-row" key={`${event.kind}-${event.id}`}>
                {(index === 0 || !isSameDay(parseISO(events[index - 1].startsAt), parseISO(event.startsAt))) ? <div className="agenda-date">{dateLabel(event)} · {formatDate(event.startsAt, { month: 'short', day: 'numeric' })}</div> : null}
                <Link className="agenda-row__content" to={event.kind === 'meeting' ? '/meetings' : '/calendar'} aria-label={`${event.kind}: ${event.title}`}><span className={event.kind === 'meeting' ? 'event-dot event-dot--meeting' : 'event-dot'} /><time>{formatTime(event.startsAt)}<small>– {formatTime(event.endsAt)}</small></time><span className={event.kind === 'meeting' ? 'event-rule event-rule--meeting' : 'event-rule'} /><div><strong>{event.title}</strong><small>{event.kind === 'meeting' ? 'Team meeting' : 'Team event'}{event.location ? ` · ${event.location}` : ''}</small></div><MemberAvatar id={event.attendeeIds.at(-1) || event.createdBy} /></Link>
              </div>
            )) : <div className="dashboard-empty schedule-empty"><CalendarDays size={28} /><strong>No schedule yet</strong><span>New team events and meetings will appear here.</span></div>}
          </div>
          <Link className="panel-link" to="/calendar">Open full calendar <ChevronRight size={16} /></Link>
        </section>
        <section className="schedule-column schedule-column--meetings" aria-labelledby="meeting-workspace-heading">
          <div className="schedule-section-heading"><div><h3 id="meeting-workspace-heading">Meeting workspace</h3><p>Agendas, minutes, and follow-ups for everyone</p></div><span className="meeting-privacy"><UsersRound size={13} /> Shared with team</span></div>
          <div className="subtabs" role="tablist" aria-label="Meeting workspace view"><button role="tab" aria-selected={meetingView === 'agenda'} className={meetingView === 'agenda' ? 'is-active' : ''} onClick={() => setMeetingView('agenda')}>Agenda</button><button role="tab" aria-selected={meetingView === 'minutes'} className={meetingView === 'minutes' ? 'is-active' : ''} onClick={() => setMeetingView('minutes')}>Minutes</button><button role="tab" aria-selected={meetingView === 'actions'} className={meetingView === 'actions' ? 'is-active' : ''} onClick={() => setMeetingView('actions')}>Actions</button></div>
          <div className="meeting-list" role="tabpanel">{meetingView === 'agenda' ? (meetings.length ? meetings.slice(0, 3).map((meeting) => <Link to="/meetings" key={meeting.id}><div><strong>{meeting.title}</strong><span><Clock3 size={14} /> {formatDate(meeting.startsAt, { month: 'short', day: 'numeric' })}, {formatTime(meeting.startsAt)}</span></div><span className={`meeting-state meeting-state--${meeting.status}`}>{meeting.status.replace('_', ' ')}</span><ChevronRight size={17} /></Link>) : <div className="dashboard-empty schedule-empty"><UsersRound size={26} /><strong>No meetings yet</strong><span>Create an agenda when you are ready.</span></div>) : meetingView === 'minutes' ? (meetingMinutes.length ? meetingMinutes.slice(0, 3).map((meeting) => <Link className="meeting-list__summary" to="/meetings" key={meeting.id}><div><strong>{meeting.title}</strong><span>{meeting.minutes}</span></div><ChevronRight size={17} /></Link>) : <div className="dashboard-empty schedule-empty"><Clock3 size={26} /><strong>No minutes yet</strong><span>Saved meeting notes will appear here.</span></div>) : (actionItems.length ? actionItems.slice(0, 3).map((task) => <Link className="meeting-list__summary" to="/tasks" key={task.id}><div><strong>{task.title}</strong><span>Due {formatDate(task.dueAt, { month: 'short', day: 'numeric' })}</span></div><ChevronRight size={17} /></Link>) : <div className="dashboard-empty schedule-empty"><CheckSquare2 size={26} /><strong>No action items</strong><span>Meeting follow-ups will appear here.</span></div>)}</div>
          <Link className="panel-link" to={meetingView === 'actions' ? '/tasks' : '/meetings'}>{meetingView === 'actions' ? 'View all tasks' : 'View all meetings'} <ChevronRight size={16} /></Link>
        </section>
      </div>
    </Panel>
  )
}

function FilesPanel({ openCreate }: { openCreate: (kind: EntityKind) => void }) {
  const { data } = useWorkspace()
  const documents = data.documents.filter((document) => !document.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5)
  return (
    <Panel title="Files & knowledge" icon={Folder} className="dashboard-files" action={<><button className="button button--secondary button--small" onClick={() => openCreate('file')}><Upload size={16} /> Upload</button><button className="icon-button icon-button--border" onClick={() => openCreate('folder')} aria-label="Create folder" title="Create folder"><FolderPlus size={18} /></button></>}>
      <div className="folder-strip">{data.folders.filter((folder) => !folder.deletedAt).slice(0, 6).map((folder) => <Link key={folder.id} to={`/files?folder=${folder.id}`}><Folder size={15} />{folder.name}</Link>)}</div>
      <div className="file-table file-table--compact">{documents.length ? <><div className="file-table__header"><span>Name</span><span>Owner</span><span>Updated</span><span /></div>{documents.map((document) => { const version = document.versions.at(-1)!; const owner = data.members.find((member) => member.id === document.ownerId) ?? FORMER_MEMBER; return <div className="file-row" key={document.id}><span className="file-name"><FileGlyph mimeType={version.mimeType} /><strong>{document.name}</strong></span><span>{owner.name}</span><span>{formatDate(document.updatedAt)}</span><button className="icon-button" aria-label={`Actions for ${document.name}`}><MoreHorizontal size={17} /></button></div> })}</> : <div className="dashboard-empty"><Folder size={28} /><strong>No files yet</strong><span>Upload the first shared resource.</span></div>}</div>
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
  const events = buildCalendarSchedule(data.events, data.meetings)
  const meetings = data.meetings.filter((meeting) => !meeting.deletedAt).sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const tasks = data.tasks.filter((task) => !task.deletedAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt))
  return (
    <div className="page dashboard-page">
      <div className="page-heading dashboard-heading"><div><h1>Welcome, {currentUser.name.split(' ')[0]}</h1></div><button className="button button--primary mobile-add-button" onClick={() => openCreate('task')}><Plus size={19} /> Add new</button></div>
      <div className="dashboard-grid">
        <SchedulePanel events={events} meetings={meetings} tasks={tasks} openCreate={openCreate} />
        <FilesPanel openCreate={openCreate} />
        <QuickLinksPanel />
        <TasksPanel tasks={tasks} openCreate={openCreate} />
        <SecureAccess />
      </div>
    </div>
  )
}
