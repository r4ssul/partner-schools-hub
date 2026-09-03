import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleOptions, json } from '../_shared/http.ts'

interface OutboxRow {
  id: number
  recipient_email: string
  subject: string
  body_html: string
  attempts: number
}

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const dispatchSecret = Deno.env.get('DISPATCH_SECRET')
  const providedSecret = request.headers.get('x-dispatch-secret')
  if (!projectUrl || !secretKey || !resendKey || !dispatchSecret) return json({ error: 'Server is not configured' }, 500)
  if (!providedSecret || providedSecret !== dispatchSecret) return json({ error: 'Unauthorized' }, 401)
  const admin = createClient(projectUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await admin.from('notification_outbox').select('id,recipient_email,subject,body_html,attempts').is('processed_at', null).lte('available_at', new Date().toISOString()).order('id').limit(50)
  if (error) return json({ error: error.message }, 500)
  const rows = (data || []) as OutboxRow[]
  const from = Deno.env.get('EMAIL_FROM') || 'Partner Schools Hub <notifications@example.com>'
  const results = await Promise.all(rows.map(async (row) => {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [row.recipient_email], subject: row.subject, html: row.body_html }),
      })
      if (!response.ok) throw new Error(await response.text())
      await admin.from('notification_outbox').update({ processed_at: new Date().toISOString(), attempts: row.attempts + 1, last_error: null }).eq('id', row.id)
      return { id: row.id, status: 'sent' }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unknown delivery error'
      await admin.from('notification_outbox').update({ attempts: row.attempts + 1, last_error: message, available_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() }).eq('id', row.id)
      return { id: row.id, status: 'failed' }
    }
  }))
  return json({ processed: results.length, results })
})
