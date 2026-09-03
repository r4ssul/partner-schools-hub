import { useMemo, useRef, useState } from 'react'
import { Download, FileClock, Folder, FolderPlus, MoreHorizontal, Plus, Search, Trash2, Upload } from 'lucide-react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { FileGlyph } from '../components/FileGlyph'
import { Modal } from '../components/Modal'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { formatDateTime } from '../lib/date'
import { downloadFileFromR2, isR2FileApiConfigured } from '../lib/fileApi'
import { supabase } from '../lib/supabase'
import type { EntityKind, Folder as HubFolder, HubDocument } from '../types'

interface OutletActions { openCreate: (kind: EntityKind) => void }

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function FilesPage() {
  const { data, currentUser, uploadFile, uploadUrls, addDocumentVersion, archiveItem } = useWorkspace()
  const { openCreate } = useOutletContext<OutletActions>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<HubDocument | null>(null)
  const [folderToDelete, setFolderToDelete] = useState<HubFolder | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const versionRef = useRef<HTMLInputElement>(null)
  const folderId = searchParams.get('folder')
  const folders = data.folders.filter((folder) => !folder.deletedAt)
  const documents = useMemo(() => data.documents.filter((document) => {
    if (document.deletedAt) return false
    if (folderId && document.folderId !== folderId) return false
    return document.name.toLowerCase().includes(query.toLowerCase())
  }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [data.documents, folderId, query])

  const handleUpload = async (file?: File) => {
    if (!file) return
    const error = await uploadFile(file, folderId || folders[0]?.id)
    setMessage(error || `${file.name} uploaded successfully.`)
  }

  const handleVersion = async (file?: File) => {
    if (!file || !selected) return
    const error = await addDocumentVersion(selected.id, file)
    setMessage(error || `Version ${selected.versions.length + 1} uploaded.`)
    if (!error) setSelected(data.documents.find((document) => document.id === selected.id) ?? selected)
  }

  const openDocument = async (document: HubDocument) => {
    const localUrl = uploadUrls.get(document.id)
    if (localUrl) { window.open(localUrl, '_blank', 'noopener,noreferrer'); return }
    if (supabase) {
      const version = document.versions.at(-1)
      if (isR2FileApiConfigured && version) {
        const previewable = version.mimeType === 'application/pdf' || version.mimeType.startsWith('image/') || version.mimeType.startsWith('text/')
        const previewWindow = previewable ? window.open('', '_blank') : null
        if (previewWindow) previewWindow.opener = null
        const result = await downloadFileFromR2(Number(version.id))
        if (result.error || !result.url) {
          previewWindow?.close()
          setMessage(result.error || 'Unable to download this file.')
          return
        }
        if (previewWindow) previewWindow.location.href = result.url
        else {
          const anchor = window.document.createElement('a')
          anchor.href = result.url
          anchor.download = document.name
          anchor.click()
        }
        window.setTimeout(() => URL.revokeObjectURL(result.url!), 60_000)
        return
      }
      const { data: access, error } = await supabase.functions.invoke('file-access', { body: { action: 'create-download', documentId: Number(document.id), versionId: Number(version?.id) } })
      if (!error && access?.url) { window.open(access.url, '_blank', 'noopener,noreferrer'); return }
      setMessage(error?.message || 'Unable to create a secure download link.')
      return
    }
    setSelected(document)
  }

  const deleteFolder = async () => {
    if (!folderToDelete) return
    try {
      await archiveItem('folder', folderToDelete.id)
      if (folderId === folderToDelete.id) setSearchParams({})
      setMessage(`${folderToDelete.name} moved to trash.`)
      setFolderToDelete(null)
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Unable to move this folder to trash.')
    }
  }

  return (
    <div className="page feature-page">
      <div className="page-heading"><div><h1>Files & knowledge</h1><p>Private documents, organized and versioned for your team.</p></div><div className="page-actions"><button className="button button--secondary" onClick={() => openCreate('folder')}><Plus size={18} /> New folder</button><button className="button button--primary" onClick={() => uploadRef.current?.click()}><Upload size={18} /> Upload file</button><input ref={uploadRef} className="visually-hidden" type="file" onChange={(event) => void handleUpload(event.target.files?.[0])} /></div></div>
      {message ? <div className={/(success|uploaded|moved to trash)/i.test(message) ? 'toast-message is-success' : 'toast-message'} role="status">{message}<button onClick={() => setMessage(null)}>Dismiss</button></div> : null}
      <div className="folder-browser" aria-label="Folders"><button className={!folderId ? 'folder-tile is-active' : 'folder-tile'} onClick={() => setSearchParams({})}><Folder size={21} /><span>All files</span><small>{data.documents.filter((document) => !document.deletedAt).length}</small></button><button className="folder-tile folder-tile--create" onClick={() => openCreate('folder')}><FolderPlus size={21} /><span>New folder</span></button>{folders.map((folder) => <div className={folderId === folder.id ? 'folder-item is-active' : 'folder-item'} key={folder.id}><button className="folder-tile" onClick={() => setSearchParams({ folder: folder.id })}><Folder size={21} /><span>{folder.name}</span><small>{data.documents.filter((document) => !document.deletedAt && document.folderId === folder.id).length}</small></button><button className="folder-delete" onClick={() => setFolderToDelete(folder)} aria-label={`Delete folder ${folder.name}`} title={`Move ${folder.name} to trash`}><Trash2 size={16} /></button></div>)}</div>
      <section className="content-surface">
        <div className="surface-toolbar"><div><h2>{folderId ? folders.find((folder) => folder.id === folderId)?.name : 'All files'}</h2><span>{documents.length} items</span></div><label className="search-field"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files" aria-label="Search files" /></label></div>
        <div className="file-table file-table--full"><div className="file-table__header"><span>Name</span><span>Owner</span><span>Size</span><span>Updated</span><span /></div>{documents.map((document) => { const version = document.versions.at(-1)!; const owner = data.members.find((member) => member.id === document.ownerId) ?? currentUser; return <div className="file-row" key={document.id}><button className="file-name file-name--button" onClick={() => void openDocument(document)}><FileGlyph mimeType={version.mimeType} /><span><strong>{document.name}</strong><small>Version {version.version}</small></span></button><span>{owner.name}</span><span>{formatBytes(version.size)}</span><span>{formatDateTime(document.updatedAt)}</span><div className="row-actions"><button className="icon-button" onClick={() => setSelected(document)} aria-label={`Details for ${document.name}`}><MoreHorizontal size={18} /></button></div></div> })}{!documents.length ? <div className="empty-state"><FileClock size={34} /><h3>No files here yet</h3><p>Upload a document or choose another folder.</p><button className="button button--primary" onClick={() => uploadRef.current?.click()}><Upload size={18} /> Upload file</button></div> : null}</div>
      </section>
      <Modal open={Boolean(selected)} title={selected?.name || 'File details'} description="Versions are immutable and remain available until the file is permanently purged." onClose={() => setSelected(null)}>
        {selected ? <div className="file-detail"><div className="file-detail__summary"><FileGlyph mimeType={selected.versions.at(-1)?.mimeType || ''} size={34} /><div><strong>{selected.name}</strong><span>Updated {formatDateTime(selected.updatedAt)}</span></div></div><div className="version-list"><h3>Version history</h3>{[...selected.versions].reverse().map((version) => <div key={version.id}><span><strong>Version {version.version}</strong><small>{formatDateTime(version.createdAt)} · {formatBytes(version.size)}</small></span><button className="icon-button" aria-label={`Download version ${version.version}`} onClick={() => void openDocument(selected)}><Download size={18} /></button></div>)}</div><div className="modal-footer"><button className="button button--danger" onClick={() => { void archiveItem('file', selected.id); setSelected(null) }}><Trash2 size={17} /> Move to trash</button><button className="button button--secondary" onClick={() => versionRef.current?.click()}><Upload size={17} /> Upload new version</button><input ref={versionRef} className="visually-hidden" type="file" onChange={(event) => void handleVersion(event.target.files?.[0])} /></div></div> : null}
      </Modal>
      <Modal open={Boolean(folderToDelete)} title="Move folder to trash?" description="The folder can be restored for 30 days. Its files will remain available from All files." onClose={() => setFolderToDelete(null)} size="sm">
        <div className="confirm-dialog"><p><strong>{folderToDelete?.name}</strong> will be removed from the folder bar for everyone in the workspace.</p><div className="modal-footer"><button className="button button--secondary" onClick={() => setFolderToDelete(null)}>Cancel</button><button className="button button--danger" onClick={() => void deleteFolder()}><Trash2 size={17} /> Move to trash</button></div></div>
      </Modal>
    </div>
  )
}
