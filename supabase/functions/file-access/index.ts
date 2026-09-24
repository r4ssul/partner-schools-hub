import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleOptions, json } from '../_shared/http.ts'

function versionIdFrom(request: Request) {
  const value = new URL(request.url).searchParams.get('versionId')
  if (!value || !/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
}

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const versionId = versionIdFrom(request)
  if (!versionId) return json({ error: 'A valid file version is required' }, 400)

  const projectUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')
  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!projectUrl || !publishableKey || !secretKey) return json({ error: 'Server is not configured' }, 500)

  const authorization = request.headers.get('Authorization') || ''
  const caller = createClient(projectUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: authData, error: authError } = await caller.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Authentication required' }, 401)

  const { data: setupComplete, error: setupError } = await caller.rpc('has_completed_password_setup')
  if (setupError || setupComplete !== true) return json({ error: 'Complete account setup before accessing files' }, 403)

  // These queries run with the caller's JWT and RLS. A version ID alone never
  // authorizes access, and archived documents cannot be downloaded.
  const { data: version, error: versionError } = await caller.from('document_versions')
    .select('id,document_id,workspace_id,storage_path,storage_provider,mime_type')
    .eq('id', versionId)
    .eq('storage_provider', 'supabase')
    .maybeSingle()
  if (versionError || !version) return json({ error: 'File not found or access denied' }, 404)
  if (!version.storage_path.startsWith(`${version.workspace_id}/`)) {
    return json({ error: 'File not found or access denied' }, 404)
  }

  const { data: document, error: documentError } = await caller.from('documents')
    .select('id,name')
    .eq('id', version.document_id)
    .eq('workspace_id', version.workspace_id)
    .is('deleted_at', null)
    .maybeSingle()
  if (documentError || !document) return json({ error: 'File not found or access denied' }, 404)

  const admin = createClient(projectUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: file, error: downloadError } = await admin.storage.from('company-documents').download(version.storage_path)
  if (downloadError || !file) return json({ error: 'Stored file is unavailable' }, 404)

  await admin.from('audit_log').insert({
    workspace_id: version.workspace_id,
    actor_id: authData.user.id,
    action: 'accessed',
    entity_kind: 'document',
    entity_id: String(document.id),
    entity_name: document.name,
    metadata: { version_id: version.id, storage_provider: 'supabase' },
  })

  const headers = new Headers(corsHeaders)
  headers.set('Content-Type', version.mime_type)
  headers.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(document.name).replace(/'/g, '%27')}`)
  headers.set('Cache-Control', 'private, no-store')
  headers.set('X-Content-Type-Options', 'nosniff')
  return new Response(file.stream(), { headers })
})
