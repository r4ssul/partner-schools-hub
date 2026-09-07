import type { HubEvent, Meeting } from '../types'

export type CalendarScheduleItem = {
  id: string
  kind: 'event' | 'meeting'
  title: string
  description: string
  startsAt: string
  endsAt: string
  location: string
  attendeeIds: string[]
  createdBy: string | null
}

export function buildCalendarSchedule(events: HubEvent[], meetings: Meeting[], userId: string): CalendarScheduleItem[] {
  const sharedEvents = events
    .filter((event) => !event.deletedAt)
    .map((event) => ({ ...event, kind: 'event' as const }))
  const privateMeetings = meetings
    .filter((meeting) => !meeting.deletedAt && meeting.attendeeIds.includes(userId))
    .map((meeting) => ({
      id: meeting.id,
      kind: 'meeting' as const,
      title: meeting.title,
      description: meeting.agenda,
      startsAt: meeting.startsAt,
      endsAt: meeting.endsAt,
      location: meeting.location,
      attendeeIds: meeting.attendeeIds,
      createdBy: meeting.createdBy,
    }))
  return [...sharedEvents, ...privateMeetings].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
}
