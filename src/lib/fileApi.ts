import { supabase } from './supabase'

const fileApiUrl = ((import.meta.env.VITE_R2_FILE_API_URL as string | undefined) || '').replace(/\/+$/, '')

export const isR2FileApiConfigured = Boolean(fileApiUrl)

interface UploadTarget {
  workspaceId: number
  folderId?: number
  documentId?: number
}

interface UploadResult {
  documentId: number
  versionId: number
  versionNumber: number
  path: string
}

async function accessToken() {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session?.access_token || null
}

async function errorMessage(response: Response) {
  try {
    const body = await response.json() as { error?: string }
    return body.error || `File service returned ${response.status}.`
  } catch {
    return `File service returned ${response.status}.`
  }
}

export async function uploadFileToR2(file: File, target: UploadTarget): Promise<{ data: UploadResult | null; error: string | null }> {
  if (!fileApiUrl) return { data: null, error: 'Cloudflare R2 file storage is not configured.' }
  try {
    const token = await accessToken()
    if (!token) return { data: null, error: 'Your session has expired. Sign in again.' }
    const headers = new Headers({
      Authorization: `Bearer ${token}`,
      'Content-Type': file.type || 'application/octet-stream',
      'X-Workspace-Id': String(target.workspaceId),
      'X-File-Name': encodeURIComponent(file.name),
      'X-File-Size': String(file.size),
    })
    if (target.folderId) headers.set('X-Folder-Id', String(target.folderId))
    if (target.documentId) headers.set('X-Document-Id', String(target.documentId))
    const response = await fetch(`${fileApiUrl}/upload`, { method: 'POST', headers, body: file })
    if (!response.ok) return { data: null, error: await errorMessage(response) }
    return { data: await response.json() as UploadResult, error: null }
  } catch (reason) {
    return { data: null, error: reason instanceof Error ? reason.message : 'Unable to reach file storage.' }
  }
}

export async function downloadFileFromR2(versionId: number): Promise<{ url: string | null; error: string | null }> {
  if (!fileApiUrl) return { url: null, error: 'Cloudflare R2 file storage is not configured.' }
  try {
    const token = await accessToken()
    if (!token) return { url: null, error: 'Your session has expired. Sign in again.' }
    const response = await fetch(`${fileApiUrl}/download?versionId=${encodeURIComponent(versionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!response.ok) return { url: null, error: await errorMessage(response) }
    return { url: URL.createObjectURL(await response.blob()), error: null }
  } catch (reason) {
    return { url: null, error: reason instanceof Error ? reason.message : 'Unable to reach file storage.' }
  }
}
