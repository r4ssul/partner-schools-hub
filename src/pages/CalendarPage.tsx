import { useMemo, useState } from 'react'
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, Trash2, Users } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { formatDate, formatTime } from '../lib/date'
import { buildCalendarSchedule, type CalendarScheduleItem } from '../lib/calendar'
import type { EntityKind } from '../types'

interface OutletActions { openCreate: (kind: EntityKind) => void }

export default function CalendarPage() {
  const { data, currentUser, archiveItem } = useWorkspace()
  const { openCreate } = useOutletContext<OutletActions>()
  const [cursor, setCursor] = useState(new Date())
  const [selected, setSelected] = useState<CalendarScheduleItem | null>(null)
  const schedule = useMemo(() => buildCalendarSchedule(data.events, data.meetings, currentUser.id), [data.events, data.meetings, currentUser.id])
  const monthStart = startOfMonth(cursor)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(endOfMonth(cursor))
  const days: Date[] = []
  for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) days.push(day)
  const upcoming = schedule.filter((item) => parseISO(item.endsAt) >= new Date()).slice(0, 8)

  return (
    <div className="page feature-page">
      <div className="page-heading"><div><h1>Team calendar</h1><p>One shared schedule for partner-school events and meetings.</p></div><button className="button button--primary" onClick={() => openCreate('event')}><Plus size={18} /> New event</button></div>
      <div className="calendar-layout">
        <section className="content-surface calendar-surface">
          <div className="calendar-toolbar"><div><button className="button button--secondary button--small" onClick={() => setCursor(new Date())}>Today</button><button className="icon-button icon-button--border" onClick={() => setCursor((value) => subMonths(value, 1))} aria-label="Previous month"><ChevronLeft size={19} /></button><button className="icon-button icon-button--border" onClick={() => setCursor((value) => addMonths(value, 1))} aria-label="Next month"><ChevronRight size={19} /></button></div><h2>{format(cursor, 'MMMM yyyy')}</h2><span>Asia/Tokyo</span></div>
          <div className="month-grid"><div className="month-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div><div className="month-days">{days.map((day) => { const dayItems = schedule.filter((item) => isSameDay(parseISO(item.startsAt), day)); return <div key={day.toISOString()} className={`${isSameMonth(day, cursor) ? 'month-day' : 'month-day is-outside'}${isSameDay(day, new Date()) ? ' is-today' : ''}`}><span className="month-day__number">{format(day, 'd')}</span>{dayItems.slice(0, 3).map((item) => <button key={`${item.kind}-${item.id}`} className={`calendar-event calendar-event--${item.kind}`} onClick={() => setSelected(item)} aria-label={`${item.kind}: ${item.title}`}><time>{formatTime(item.startsAt)}</time><span>{item.title}</span></button>)}{dayItems.length > 3 ? <small>+{dayItems.length - 3} more</small> : null}</div> })}</div></div>
        </section>
        <aside className="content-surface agenda-sidebar"><div className="surface-toolbar"><div><h2>Upcoming</h2><span>{upcoming.length} scheduled</span></div><CalendarDays size={22} /></div><div className="agenda-sidebar__list">{upcoming.length ? upcoming.map((item) => <button key={`${item.kind}-${item.id}`} onClick={() => setSelected(item)}><time><strong>{formatDate(item.startsAt, { month: 'short' })}</strong><span>{formatDate(item.startsAt, { day: 'numeric' })}</span></time><div><strong>{item.title}</strong><span>{item.kind === 'meeting' ? 'Meeting · ' : ''}{formatTime(item.startsAt)} · {item.location || 'No location'}</span></div><ChevronRight size={17} /></button>) : <div className="empty-state empty-state--compact"><CalendarDays size={30} /><h3>No schedule yet</h3><p>Create an event or meeting to start the calendar.</p></div>}</div></aside>
      </div>
      <Modal open={Boolean(selected)} title={selected?.title || 'Schedule item'} description={selected?.kind === 'meeting' ? 'Private meeting · visible only to attendees' : 'Shared event · visible to everyone'} onClose={() => setSelected(null)}>
        {selected ? <div className="detail-stack"><p>{selected.description || `No ${selected.kind === 'meeting' ? 'agenda' : 'description'} added.`}</p><dl className="detail-list"><div><dt><Clock3 size={17} />When</dt><dd>{formatDate(selected.startsAt)} · {formatTime(selected.startsAt)}–{formatTime(selected.endsAt)}</dd></div><div><dt><MapPin size={17} />Location</dt><dd>{selected.location || 'Not set'}</dd></div><div><dt><Users size={17} />Attendees</dt><dd>{selected.attendeeIds.length} team members</dd></div></dl><div className="modal-footer"><button className="button button--danger" onClick={() => { void archiveItem(selected.kind, selected.id); setSelected(null) }}><Trash2 size={17} /> Move to trash</button></div></div> : null}
      </Modal>
    </div>
  )
}
