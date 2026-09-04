import { readFile } from 'node:fs/promises'

const project = process.env.SUPABASE_PROJECT_REF
const token = process.env.SUPABASE_ACCESS_TOKEN
if (!project || !/^[a-z]{20}$/.test(project) || !token) {
  throw new Error('Set SUPABASE_PROJECT_REF and SUPABASE_ACCESS_TOKEN in your environment. Never commit credentials.')
}
const endpoint = `https://api.supabase.com/v1/projects/${project}/config/auth`
const template = await readFile(new URL('../supabase/templates/invite.html', import.meta.url), 'utf8')
const subject = 'You’re invited to Partner Schools Hub'
const request = async (method, body) => {
  const response = await fetch(endpoint, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}))
    const detail = typeof failure.message === 'string' ? failure.message.replaceAll(token, '[redacted]').slice(0, 500) : 'No further details provided'
    throw new Error(`Supabase Auth configuration request failed (${response.status}): ${detail}`)
  }
  return response.json()
}
// Update ONLY the invitation subject/body. Preserve SMTP, redirect URLs,
// signup restrictions, passwords, and every other hosted Auth setting.
await request('PATCH', { mailer_subjects_invite: subject, mailer_templates_invite_content: template })
const saved = await request('GET')
if (saved.mailer_subjects_invite !== subject || saved.mailer_templates_invite_content !== template) {
  throw new Error('The saved invitation template did not match. Inspect the hosted Auth settings before retrying.')
}
console.log('Verified: branded invitation subject and HTML saved to the hosted Supabase project.')
console.log(saved.smtp_host ? 'Custom SMTP is configured.' : 'Sender remains Supabase Auth until custom SMTP is configured.')
