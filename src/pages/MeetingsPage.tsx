import { useMemo, useState } from 'react'
import { CheckSquare2, Clock3, FileText, MapPin, Plus, Save, Trash2, UsersRound } from 'lucide-react'
import { useOutletContext } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { formatDateTime } from '../lib/date'
import type { EntityKind } from '../types'

interface OutletActions { openCreate: (kind: EntityKind, sourceMeetingId?: string | null) => void }

export default function MeetingsPage() {
  const { data, updateMeetingNotes, archiveItem } = useWorkspace()
  const { openCreate } = useOutletContext<OutletActions>()
  const meetings = useMemo(() => data.meetings.filter((meeting) => !meeting.deletedAt).sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [data.meetings])
  const [selectedId, setSelectedId] = useState(meetings[0]?.id)
  const selected = meetings.find((meeting) => meeting.id === selectedId) ?? meetings[0]
  const [agenda, setAgenda] = useState(selected?.agenda || '')
  const [minutes, setMinutes] = useState(selected?.minutes || '')
  const [saved, setSaved] = useState(false)
  const selectMeeting = (meetingId: string) => {
    const meeting = meetings.find((candidate) => candidate.id === meetingId)
    setSelectedId(meetingId)
    setAgenda(meeting?.agenda || '')
    setMinutes(meeting?.minutes || '')
    setSaved(false)
  }

  const save = async () => {
    if (!selected) return
    await updateMeetingNotes(selected.id, agenda, minutes)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="page feature-page">
      <div className="page-heading"><div><h1>Meetings</h1><p>Keep agendas, minutes, documents and action items together.</p></div><button className="button button--primary" onClick={() => openCreate('meeting')}><Plus size={18} /> New meeting</button></div>
      <div className="master-detail">
        <aside className="content-surface master-list"><div className="surface-toolbar"><div><h2>All meetings</h2><span>{meetings.length} active</span></div></div>{meetings.map((meeting) => <button className={selected?.id === meeting.id ? 'master-row is-active' : 'master-row'} key={meeting.id} onClick={() => selectMeeting(meeting.id)}><span className={`meeting-icon meeting-icon--${meeting.status}`}><UsersRound size={19} /></span><span><strong>{meeting.title}</strong><small>{formatDateTime(meeting.startsAt)}</small></span><span className={`meeting-state meeting-state--${meeting.status}`}>{meeting.status.replace('_', ' ')}</span></button>)}</aside>
        <section className="content-surface detail-pane">{selected ? <><div className="detail-pane__heading"><div><span className={`meeting-state meeting-state--${selected.status}`}>{selected.status.replace('_', ' ')}</span><h2>{selected.title}</h2><p><Clock3 size={16} /> {formatDateTime(selected.startsAt)} <span>·</span> <MapPin size={16} /> {selected.location}</p></div><div className="page-actions"><button className="button button--secondary" onClick={() => openCreate('task', selected.id)}><CheckSquare2 size={17} /> Add action item</button><button className="button button--primary" onClick={() => void save()}><Save size={17} /> {saved ? 'Saved' : 'Save notes'}</button></div></div><div className="attendee-row"><strong>Attendees</strong>{selected.attendeeIds.map((id) => { const member = data.members.find((candidate) => candidate.id === id); return member ? <span key={id}><Avatar member={member} size="sm" />{member.name}</span> : null })}</div><div className="meeting-editor-grid"><label className="editor-field"><span>Agenda</span><textarea value={agenda} onChange={(event) => setAgenda(event.target.value)} rows={12} placeholder="Topics and decisions to cover…" /></label><label className="editor-field"><span>Minutes</span><textarea value={minutes} onChange={(event) => setMinutes(event.target.value)} rows={12} placeholder="Capture decisions and follow-ups…" /></label></div><div className="linked-files"><h3><FileText size={18} /> Linked files</h3>{selected.documentIds.length ? selected.documentIds.map((id) => <span key={id}>{data.documents.find((document) => document.id === id)?.name}</span>) : <p>No files linked yet.</p>}</div><button className="text-danger" onClick={() => void archiveItem('meeting', selected.id)}><Trash2 size={16} /> Move meeting to trash</button></> : <div className="empty-state"><UsersRound size={36} /><h3>No meetings yet</h3><button className="button button--primary" onClick={() => openCreate('meeting')}>Create a meeting</button></div>}</section>
      </div>
    </div>
  )
}
