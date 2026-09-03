import { useMemo, useState } from 'react'
import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Plus, Trash2, Users } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { formatDate, formatTime } from '../lib/date'
import type { EntityKind, HubEvent } from '../types'

interface OutletActions { openCreate: (kind: EntityKind) => void }

export default function CalendarPage() {
  const { data, archiveItem } = useWorkspace()
  const { openCreate } = useOutletContext<OutletActions>()
  const [cursor, setCursor] = useState(new Date())
  const [selected, setSelected] = useState<HubEvent | null>(null)
  const events = useMemo(() => data.events.filter((event) => !event.deletedAt).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [data.events])
  const monthStart = startOfMonth(cursor)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(endOfMonth(cursor))
  const days: Date[] = []
  for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) days.push(day)
  const upcoming = events.filter((event) => parseISO(event.endsAt) >= new Date()).slice(0, 8)

  return (
    <div className="page feature-page">
      <div className="page-heading"><div><h1>Team calendar</h1><p>One shared schedule for partner-school events and meetings.</p></div><button className="button button--primary" onClick={() => openCreate('event')}><Plus size={18} /> New event</button></div>
      <div className="calendar-layout">
        <section className="content-surface calendar-surface">
          <div className="calendar-toolbar"><div><button className="button button--secondary button--small" onClick={() => setCursor(new Date())}>Today</button><button className="icon-button icon-button--border" onClick={() => setCursor((value) => subMonths(value, 1))} aria-label="Previous month"><ChevronLeft size={19} /></button><button className="icon-button icon-button--border" onClick={() => setCursor((value) => addMonths(value, 1))} aria-label="Next month"><ChevronRight size={19} /></button></div><h2>{format(cursor, 'MMMM yyyy')}</h2><span>Asia/Tokyo</span></div>
          <div className="month-grid"><div className="month-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div><div className="month-days">{days.map((day) => { const dayEvents = events.filter((event) => isSameDay(parseISO(event.startsAt), day)); return <div key={day.toISOString()} className={`${isSameMonth(day, cursor) ? 'month-day' : 'month-day is-outside'}${isSameDay(day, new Date()) ? ' is-today' : ''}`}><span className="month-day__number">{format(day, 'd')}</span>{dayEvents.slice(0, 3).map((event) => <button key={event.id} className="calendar-event" onClick={() => setSelected(event)}><time>{formatTime(event.startsAt)}</time><span>{event.title}</span></button>)}{dayEvents.length > 3 ? <small>+{dayEvents.length - 3} more</small> : null}</div> })}</div></div>
        </section>
        <aside className="content-surface agenda-sidebar"><div className="surface-toolbar"><div><h2>Upcoming</h2><span>{upcoming.length} scheduled</span></div><CalendarDays size={22} /></div><div className="agenda-sidebar__list">{upcoming.length ? upcoming.map((event) => <button key={event.id} onClick={() => setSelected(event)}><time><strong>{formatDate(event.startsAt, { month: 'short' })}</strong><span>{formatDate(event.startsAt, { day: 'numeric' })}</span></time><div><strong>{event.title}</strong><span>{formatTime(event.startsAt)} · {event.location}</span></div><ChevronRight size={17} /></button>) : <div className="empty-state empty-state--compact"><CalendarDays size={30} /><h3>No events scheduled</h3><p>Create an event to start the shared calendar.</p></div>}</div></aside>
      </div>
      <Modal open={Boolean(selected)} title={selected?.title || 'Event'} onClose={() => setSelected(null)}>
        {selected ? <div className="detail-stack"><p>{selected.description || 'No description added.'}</p><dl className="detail-list"><div><dt><Clock3 size={17} />When</dt><dd>{formatDate(selected.startsAt)} · {formatTime(selected.startsAt)}–{formatTime(selected.endsAt)}</dd></div><div><dt><MapPin size={17} />Location</dt><dd>{selected.location || 'Not set'}</dd></div><div><dt><Users size={17} />Attendees</dt><dd>{selected.attendeeIds.length} team members</dd></div></dl><div className="modal-footer"><button className="button button--danger" onClick={() => { void archiveItem('event', selected.id); setSelected(null) }}><Trash2 size={17} /> Move to trash</button></div></div> : null}
      </Modal>
    </div>
  )
}
