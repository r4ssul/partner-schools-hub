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
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')
  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const emailFrom = Deno.env.get('EMAIL_FROM')
  const dispatchSecret = Deno.env.get('DISPATCH_SECRET')
  const providedSecret = request.headers.get('x-dispatch-secret')
  if (!projectUrl || !publishableKey || !secretKey) return json({ error: 'Server is not configured' }, 500)
  const admin = createClient(projectUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })

  let workspaceId: number | null = null
  const scheduled = Boolean(dispatchSecret && providedSecret === dispatchSecret)
  if (!scheduled) {
    const authorization = request.headers.get('Authorization') || ''
    const caller = createClient(projectUrl, publishableKey, { global: { headers: { Authorization: authorization } } })
    const { data: authData, error: authError } = await caller.auth.getUser()
    if (authError || !authData.user) return json({ error: 'Authentication required' }, 401)
    const { data: setupComplete, error: setupError } = await caller.rpc('has_completed_password_setup')
    if (setupError || setupComplete !== true) return json({ error: 'Set your password before accessing the workspace' }, 403)
    let body: { workspaceId?: number }
    try { body = await request.json() } catch { return json({ error: 'Invalid request body' }, 400) }
    if (!Number.isSafeInteger(body.workspaceId) || Number(body.workspaceId) <= 0) return json({ error: 'Invalid workspace' }, 400)
    workspaceId = Number(body.workspaceId)
    const { data: membership } = await admin.from('workspace_members').select('active').eq('workspace_id', workspaceId).eq('user_id', authData.user.id).maybeSingle()
    if (!membership?.active) return json({ error: 'Active workspace membership required' }, 403)
  }
  if (!resendKey || !emailFrom) return json({ error: 'Email delivery provider is not configured', queued: true }, 503)

  let query = admin.from('notification_outbox').select('id,recipient_email,subject,body_html,attempts').is('processed_at', null).lte('available_at', new Date().toISOString()).order('id').limit(50)
  if (workspaceId) query = query.eq('workspace_id', workspaceId)
  const { data, error } = await query
  if (error) return json({ error: error.message }, 500)
  const rows = (data || []) as OutboxRow[]
  const results = await Promise.all(rows.map(async (row) => {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: emailFrom, to: [row.recipient_email], subject: row.subject, html: row.body_html }),
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
