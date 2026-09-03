interface AuthenticatedUser {
  id: string
}

interface RegisteredUpload {
  document_id: number
  version_id: number
  version_number: number
}

interface DownloadRecord {
  object_key: string
  file_name: string
  file_mime_type: string
  file_size: number
}

const MAX_FILE_BYTES = 50 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'text/plain', 'text/csv',
])

function allowedOrigin(request: Request, env: Env) {
  const origin = request.headers.get('Origin')
  if (!origin) return null
  return env.ALLOWED_ORIGINS.split(',').map((value) => value.trim()).find((value) => value === origin) || null
}

function responseHeaders(request: Request, env: Env) {
  const headers = new Headers({
    'Access-Control-Allow-Headers': 'authorization,content-type,x-workspace-id,x-folder-id,x-document-id,x-file-name,x-file-size',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  })
  const origin = allowedOrigin(request, env)
  if (origin) headers.set('Access-Control-Allow-Origin', origin)
  return headers
}

function json(request: Request, env: Env, body: unknown, status = 200) {
  const headers = responseHeaders(request, env)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { status, headers })
}

function logError(message: string, error: unknown, request: Request) {
  console.error(JSON.stringify({
    message,
    error: error instanceof Error ? error.message : String(error),
    method: request.method,
    path: new URL(request.url).pathname,
  }))
}

function safeName(value: string) {
  return value.normalize('NFKC').replace(/[^a-zA-Z0-9._()\- ]/g, '-').replace(/\s+/g, '-').slice(0, 180) || 'file'
}

function positiveInteger(value: string | null) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

function nonNegativeInteger(value: string | null) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

function authorization(request: Request) {
  const value = request.headers.get('Authorization') || ''
  return /^Bearer\s+\S+$/i.test(value) ? value : null
}

function supabaseUrl(env: Env, path: string) {
  return `${env.SUPABASE_URL.replace(/\/+$/, '')}${path}`
}

async function authenticate(request: Request, env: Env) {
  const auth = authorization(request)
  if (!auth) return null
  const response = await fetch(supabaseUrl(env, '/auth/v1/user'), {
    headers: { Authorization: auth, apikey: env.SUPABASE_PUBLISHABLE_KEY },
  })
  if (!response.ok) return null
  const user = await response.json() as AuthenticatedUser
  return user.id ? { auth, user } : null
}

async function rpc<T>(env: Env, auth: string, functionName: string, body: Record<string, unknown>) {
  const response = await fetch(supabaseUrl(env, `/rest/v1/rpc/${functionName}`), {
    method: 'POST',
    headers: {
      Authorization: auth,
      apikey: env.SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Supabase RPC ${functionName} failed with ${response.status}`)
  const payload = await response.json() as T[] | T
  return Array.isArray(payload) ? payload[0] : payload
}

async function upload(request: Request, env: Env) {
  const session = await authenticate(request, env)
  if (!session) return json(request, env, { error: 'Authentication required' }, 401)
  const workspaceId = positiveInteger(request.headers.get('X-Workspace-Id'))
  const folderId = positiveInteger(request.headers.get('X-Folder-Id'))
  const documentId = positiveInteger(request.headers.get('X-Document-Id'))
  const size = nonNegativeInteger(request.headers.get('X-File-Size'))
  const contentLength = nonNegativeInteger(request.headers.get('Content-Length'))
  const mimeType = request.headers.get('Content-Type') || ''
  let fileName: string
  try { fileName = decodeURIComponent(request.headers.get('X-File-Name') || '') } catch { return json(request, env, { error: 'Invalid file name' }, 400) }
  if (!workspaceId || (!folderId && !documentId) || size === null || contentLength === null || !fileName || !request.body) return json(request, env, { error: 'File metadata is incomplete' }, 400)
  if (size > MAX_FILE_BYTES || contentLength > MAX_FILE_BYTES) return json(request, env, { error: 'Files must be 50 MB or smaller' }, 413)
  if (contentLength !== size) return json(request, env, { error: 'File size headers did not match' }, 400)
  if (!ALLOWED_MIME_TYPES.has(mimeType)) return json(request, env, { error: 'Unsupported file type' }, 415)
  try {
    const isMember = await rpc<boolean>(env, session.auth, 'is_workspace_member', { target_workspace_id: workspaceId })
    if (!isMember) return json(request, env, { error: 'Workspace access denied' }, 403)
  } catch (error) {
    logError('Workspace membership check failed', error, request)
    return json(request, env, { error: 'Unable to verify workspace access' }, 403)
  }

  const objectKey = `${workspaceId}/${crypto.randomUUID()}/${safeName(fileName)}`
  const stored = await env.FILES.put(objectKey, request.body, {
    httpMetadata: { contentType: mimeType },
    customMetadata: { workspaceId: String(workspaceId), uploadedBy: session.user.id },
  })
  if (!stored || stored.size !== size) {
    await env.FILES.delete(objectKey)
    return json(request, env, { error: 'Uploaded file size did not match the request' }, 400)
  }

  try {
    const registered = await rpc<RegisteredUpload>(env, session.auth, 'register_r2_upload', {
      target_workspace_id: workspaceId,
      target_folder_id: folderId,
      target_document_id: documentId,
      target_object_key: objectKey,
      target_file_name: fileName,
      target_mime_type: mimeType,
      target_size_bytes: size,
    })
    return json(request, env, {
      documentId: registered.document_id,
      versionId: registered.version_id,
      versionNumber: registered.version_number,
      path: objectKey,
    })
  } catch (error) {
    logError('R2 upload registration failed', error, request)
    await env.FILES.delete(objectKey)
    return json(request, env, { error: 'Unable to register the uploaded file' }, 400)
  }
}

async function download(request: Request, env: Env) {
  const session = await authenticate(request, env)
  if (!session) return json(request, env, { error: 'Authentication required' }, 401)
  const versionId = positiveInteger(new URL(request.url).searchParams.get('versionId'))
  if (!versionId) return json(request, env, { error: 'A valid version is required' }, 400)
  let record: DownloadRecord
  try {
    record = await rpc<DownloadRecord>(env, session.auth, 'get_r2_download', { target_version_id: versionId })
  } catch (error) {
    logError('R2 download authorization failed', error, request)
    return json(request, env, { error: 'File not found or access denied' }, 404)
  }
  if (!record?.object_key) return json(request, env, { error: 'File not found' }, 404)
  const object = await env.FILES.get(record.object_key)
  if (!object) return json(request, env, { error: 'Stored file is missing' }, 404)
  const headers = responseHeaders(request, env)
  object.writeHttpMetadata(headers)
  headers.set('Content-Type', record.file_mime_type)
  headers.set('Content-Length', String(record.file_size))
  headers.set('ETag', object.httpEtag)
  headers.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(record.file_name)}`)
  return new Response(object.body, { headers })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    if (origin && !allowedOrigin(request, env)) return json(request, env, { error: 'Origin not allowed' }, 403)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: responseHeaders(request, env) })
    const path = new URL(request.url).pathname
    try {
      if (path === '/upload' && request.method === 'POST') return await upload(request, env)
      if (path === '/download' && request.method === 'GET') return await download(request, env)
      if (path === '/health' && request.method === 'GET') return json(request, env, { ok: true })
      return json(request, env, { error: 'Not found' }, 404)
    } catch (error) {
      logError('Unhandled file service error', error, request)
      return json(request, env, { error: 'File service unavailable' }, 500)
    }
  },
} satisfies ExportedHandler<Env>
