import { describe, expect, it } from 'vitest'
import { buildCalendarSchedule } from './calendar'
import type { HubEvent, Meeting } from '../types'

const common = { description: '', startsAt: '2026-09-07T01:00:00Z', endsAt: '2026-09-07T02:00:00Z', location: '', attendeeIds: ['member-a'], documentIds: [], createdBy: 'member-a', updatedAt: '2026-09-07T00:00:00Z', deletedAt: null }
const event: HubEvent = { ...common, id: 'event-1', title: 'Shared event' }
const meeting: Meeting = { ...common, id: 'meeting-1', title: 'Private meeting', agenda: '', minutes: '', status: 'upcoming' }

describe('buildCalendarSchedule', () => {
  it('shows every active event even when the viewer is not an attendee', () => {
    expect(buildCalendarSchedule([event], [], 'member-b').map((item) => item.title)).toEqual(['Shared event'])
  })

  it('shows meetings only to their attendees', () => {
    expect(buildCalendarSchedule([], [meeting], 'member-a')).toHaveLength(1)
    expect(buildCalendarSchedule([], [meeting], 'member-b')).toHaveLength(0)
  })

  it('combines visible events and meetings in chronological order', () => {
    const laterEvent = { ...event, id: 'event-2', startsAt: '2026-09-08T01:00:00Z' }
    expect(buildCalendarSchedule([laterEvent], [meeting], 'member-a').map((item) => item.kind)).toEqual(['meeting', 'event'])
  })
})
