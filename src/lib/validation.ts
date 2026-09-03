import { z } from 'zod'

export const createItemSchema = z
  .object({
    kind: z.enum(['file', 'folder', 'event', 'meeting', 'task', 'link']),
    title: z.string().trim().min(2, 'Enter at least 2 characters').max(120),
    description: z.string().trim().max(2000).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    location: z.string().trim().max(200).optional(),
    assigneeId: z.string().optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    dueDate: z.string().optional(),
    url: z.string().trim().optional(),
    category: z.string().trim().max(80).optional(),
    parentId: z.string().nullable().optional(),
    attendeeIds: z.array(z.string()).optional(),
    documentIds: z.array(z.string()).optional(),
    sourceMeetingId: z.string().nullable().optional(),
    sourceEventId: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'link') {
      const result = z.string().url().safeParse(data.url)
      if (!result.success) ctx.addIssue({ code: 'custom', path: ['url'], message: 'Enter a valid URL' })
    }
    if ((data.kind === 'event' || data.kind === 'meeting') && !data.startDate) {
      ctx.addIssue({ code: 'custom', path: ['startDate'], message: 'Choose a start date' })
    }
    if (data.kind === 'task' && !data.dueDate) {
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Choose a due date' })
    }
  })

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const memberProfileSchema = z.object({
  name: z.string().trim().min(2, 'Enter at least 2 characters').max(120),
  organization: z.string().trim().min(2, 'Enter the organisation you represent').max(120),
  jobTitle: z.string().trim().max(120),
  phone: z.string().trim().max(40),
})

export const memberInvitationSchema = memberProfileSchema.pick({ name: true, organization: true, jobTitle: true }).extend({
  email: z.string().trim().email('Enter a valid email address'),
})

export const ALLOWED_FILE_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'text/plain',
  'text/csv',
])

export const MAX_FILE_BYTES = 50 * 1024 * 1024

export function validateUpload(file: File) {
  if (file.size > MAX_FILE_BYTES) return 'Files must be 50 MB or smaller.'
  if (!ALLOWED_FILE_TYPES.has(file.type)) return 'This file type is not supported.'
  return null
}
