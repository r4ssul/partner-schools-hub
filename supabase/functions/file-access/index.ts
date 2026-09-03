import { createClient } from 'npm:@supabase/supabase-js@2'
import { handleOptions, json } from '../_shared/http.ts'

const MAX_FILE_BYTES = 50 * 1024 * 1024
const allowedMimeTypes = new Set([
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain', 'text/csv',
])

interface FileRequest {
  action: 'create-upload' | 'create-version' | 'create-download'
  workspaceId?: number
  folderId?: number
  documentId?: number
  versionId?: number
  fileName?: string
  mimeType?: string
  sizeBytes?: number
}

function safeName(name: string) {
  return name.normalize('NFKC').replace(/[^a-zA-Z0-9._()\- ]/g, '-').replace(/\s+/g, '-').slice(0, 180)
}

Deno.serve(async (request) => {
  const options = handleOptions(request)
  if (options) return options
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const projectUrl = Deno.env.get('SUPABASE_URL')
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY')
  const secretKey = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!projectUrl || !publishableKey || !secretKey) return json({ error: 'Server is not configured' }, 500)
  const authorization = request.headers.get('Authorization') || ''
  const caller = createClient(projectUrl, publishableKey, { global: { headers: { Authorization: authorization } } })
  const admin = createClient(projectUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: authData, error: authError } = await caller.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Authentication required' }, 401)

  let body: FileRequest
  try { body = await request.json() } catch { return json({ error: 'Invalid request body' }, 400) }
  let workspaceId = body.workspaceId
  if (!workspaceId && body.documentId) {
    const { data: document } = await admin.from('documents').select('workspace_id').eq('id', body.documentId).single()
    workspaceId = document?.workspace_id
  }
  if (!workspaceId) return json({ error: 'Workspace is required' }, 400)
  const { data: membership } = await admin.from('workspace_members').select('active').eq('workspace_id', workspaceId).eq('user_id', authData.user.id).single()
  if (!membership?.active) return json({ error: 'Workspace access denied' }, 403)

  if (body.action === 'create-upload' || body.action === 'create-version') {
    if (!body.fileName || !body.mimeType || body.sizeBytes === undefined) return json({ error: 'File metadata is required' }, 400)
    if (body.sizeBytes < 0 || body.sizeBytes > MAX_FILE_BYTES) return json({ error: 'Files must be 50 MB or smaller' }, 400)
    if (!allowedMimeTypes.has(body.mimeType)) return json({ error: 'Unsupported file type' }, 400)
    let documentId = body.documentId
    let versionNumber = 1
    if (body.action === 'create-upload') {
      if (!body.folderId) return json({ error: 'Folder is required' }, 400)
      const { data: document, error } = await admin.from('documents').insert({ workspace_id: workspaceId, folder_id: body.folderId, name: body.fileName, owner_id: authData.user.id, created_by: authData.user.id }).select('id').single()
      if (error || !document) return json({ error: error?.message || 'Unable to create document' }, 400)
      documentId = document.id
    } else {
      const { data: lastVersion } = await admin.from('document_versions').select('version_number').eq('document_id', documentId).order('version_number', { ascending: false }).limit(1).maybeSingle()
      versionNumber = (lastVersion?.version_number || 0) + 1
      await admin.from('documents').update({ name: body.fileName }).eq('id', documentId)
    }
    const path = `${workspaceId}/${documentId}/${versionNumber}/${crypto.randomUUID()}-${safeName(body.fileName)}`
    const { data: version, error: versionError } = await admin.from('document_versions').insert({ workspace_id: workspaceId, document_id: documentId, version_number: versionNumber, storage_path: path, size_bytes: body.sizeBytes, mime_type: body.mimeType, uploaded_by: authData.user.id }).select('id').single()
    if (versionError || !version) return json({ error: versionError?.message || 'Unable to create version' }, 400)
    const { data: signed, error: signedError } = await admin.storage.from('company-documents').createSignedUploadUrl(path)
    if (signedError) return json({ error: signedError.message }, 400)
    await admin.from('audit_log').insert({ workspace_id: workspaceId, actor_id: authData.user.id, action: body.action === 'create-upload' ? 'uploaded' : 'added version', entity_kind: 'document', entity_id: String(documentId), entity_name: body.fileName, metadata: { version: versionNumber, size_bytes: body.sizeBytes } })
    return json({ path, token: signed.token, documentId, versionId: version.id, versionNumber })
  }

  if (body.action === 'create-download') {
    if (!body.versionId && !body.documentId) return json({ error: 'Document or version is required' }, 400)
    let query = admin.from('document_versions').select('id,document_id,storage_path,documents(name)')
    query = body.versionId ? query.eq('id', body.versionId) : query.eq('document_id', body.documentId).order('version_number', { ascending: false }).limit(1)
    const { data: version, error } = await query.maybeSingle()
    if (error || !version) return json({ error: error?.message || 'Version not found' }, 404)
    const { data: signed, error: signedError } = await admin.storage.from('company-documents').createSignedUrl(version.storage_path, 300)
    if (signedError) return json({ error: signedError.message }, 400)
    const document = Array.isArray(version.documents) ? version.documents[0] : version.documents
    await admin.from('audit_log').insert({ workspace_id: workspaceId, actor_id: authData.user.id, action: 'accessed', entity_kind: 'document', entity_id: String(version.document_id), entity_name: document?.name || 'Document', metadata: { version_id: version.id } })
    return json({ url: signed.signedUrl, expiresIn: 300 })
  }

  return json({ error: 'Unsupported action' }, 400)
})
