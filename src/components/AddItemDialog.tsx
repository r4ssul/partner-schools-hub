import { zodResolver } from '@hookform/resolvers/zod'
import { useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { CalendarDays, CheckSquare2, FileText, FolderPlus, Link2, LoaderCircle, Upload, UsersRound, X } from 'lucide-react'
import { createItemSchema, validateUpload } from '../lib/validation'
import { toDateInput, toInputDateTime } from '../lib/date'
import type { EntityKind, NewItemInput } from '../types'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { Modal } from './Modal'

const choices = [
  { kind: 'file', label: 'Upload file', hint: 'Share a resource', icon: Upload },
  { kind: 'folder', label: 'New folder', hint: 'Keep things organised', icon: FolderPlus },
  { kind: 'event', label: 'Event', hint: 'Plan something together', icon: CalendarDays },
  { kind: 'meeting', label: 'Meeting', hint: 'Bring the team together', icon: UsersRound },
  { kind: 'task', label: 'Task', hint: 'Give a follow-up an owner', icon: CheckSquare2 },
  { kind: 'link', label: 'Quick link', hint: 'Keep a useful shortcut', icon: Link2 },
] satisfies Array<{ kind: EntityKind; label: string; hint: string; icon: typeof FileText }>

export function AddItemDialog({ open, initialKind = 'task', sourceMeetingId = null, onClose }: { open: boolean; initialKind?: EntityKind; sourceMeetingId?: string | null; onClose: () => void }) {
  const { data, currentUser, addItem, uploadFile } = useWorkspace()
  const [kind, setKind] = useState<EntityKind>(initialKind)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [folderQuery, setFolderQuery] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const [now] = useState(() => new Date().toISOString())
  const form = useForm<NewItemInput>({
    resolver: zodResolver(createItemSchema),
    defaultValues: { kind: initialKind, title: '', description: '', startDate: toInputDateTime(now), endDate: toInputDateTime(new Date(Date.parse(now) + 3600000).toISOString()), dueDate: toDateInput(now), priority: 'medium', assigneeId: currentUser.id, category: 'General', parentId: '', attendeeIds: [currentUser.id], documentIds: [], sourceMeetingId },
  })
  const { errors, isSubmitting } = form.formState
  const folders = data.folders.filter((folder) => !folder.deletedAt)
  const files = data.documents.filter((file) => !file.deletedAt)
  const activeChoice = choices.find((choice) => choice.kind === kind)!
  const folderPath = (id: string): string => {
    const parts: string[] = []
    const visited = new Set<string>()
    let folder = folders.find((item) => item.id === id)
    while (folder && !visited.has(folder.id)) {
      visited.add(folder.id); parts.unshift(folder.name)
      folder = folders.find((item) => item.id === folder?.parentId)
    }
    return parts.join(' / ')
  }
  const selectedParent = useWatch({ control: form.control, name: 'parentId' })
  const selectFile = (file?: File) => {
    if (!file) return
    const error = validateUpload(file)
    setSubmitError(error)
    if (!error) setSelectedFile(file)
  }
  const chooseKind = (next: EntityKind) => {
    if (isSubmitting) return
    setKind(next); form.setValue('kind', next); form.clearErrors(); setSubmitError(null)
  }
  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null)
    try {
      if (kind === 'file') {
        if (!selectedFile) { setSubmitError('Choose a file to upload.'); return }
        if (!values.parentId) { setSubmitError('Choose a destination folder.'); return }
        const error = await uploadFile(selectedFile, values.parentId)
        if (error) { setSubmitError(error); return }
      } else {
        if (kind === 'folder' && folders.some((folder) => (folder.parentId || '') === (values.parentId || '') && folder.name.toLowerCase() === values.title.toLowerCase())) {
          form.setError('title', { message: 'A folder with this name already exists here.' }); return
        }
        await addItem({ ...values, kind, parentId: values.parentId || null, sourceMeetingId })
      }
      onClose()
    } catch (error) { setSubmitError(error instanceof Error ? error.message : (error as { message?: string })?.message || 'Unable to save. Your details are still here—please try again.') }
  })

  return (
    <Modal open={open} title="Add new" description="One place for everything your team needs." onClose={onClose} size="lg" className="creation-modal" busy={isSubmitting}>
      <div className="creation-layout">
        <div className="creation-types" role="group" aria-label="Item type">
          {choices.map(({ kind: choiceKind, label, hint, icon: Icon }) => <button key={choiceKind} type="button" aria-label={label} aria-pressed={kind === choiceKind} disabled={isSubmitting} className={kind === choiceKind ? 'creation-type is-active' : 'creation-type'} onClick={() => chooseKind(choiceKind)}><Icon size={20} /><span>{label}<small>{hint}</small></span></button>)}
          <p className="creation-private">Shared with your workspace.<br />Visible to invited members only.</p>
        </div>
        <form className="creation-form" onSubmit={submit} noValidate aria-busy={isSubmitting}>
          <div className="creation-intro"><span className="creation-intro-icon"><activeChoice.icon size={22} /></span><div><h3>{activeChoice.label}</h3><p>{activeChoice.hint}</p></div></div>
          <fieldset className="form-grid creation-fields" disabled={isSubmitting}>
            {kind === 'file' ? <div className="field field--full">
              <span>File</span>
              <input ref={fileInput} className="file-picker-input" tabIndex={-1} type="file" aria-label="Choose file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif,.txt,.csv" onChange={(event) => selectFile(event.target.files?.[0])} />
              <button type="button" className={'upload-dropzone ' + (dragging ? 'is-dragging ' : '') + (selectedFile ? 'has-file' : '')} onClick={() => fileInput.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length > 1) setSubmitError('Upload one file at a time.'); else selectFile(event.dataTransfer.files[0]) }}>
                {selectedFile ? <FileText size={30} /> : <Upload size={30} />}<strong>{selectedFile?.name || 'Choose a file or drop it here'}</strong><span>{selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB · Click to replace' : 'PDF, Office documents, images, text & CSV · Up to 50 MB'}</span>
              </button>
              {selectedFile ? <button type="button" className="text-button file-remove" onClick={() => { setSelectedFile(null); if (fileInput.current) fileInput.current.value = '' }}><X size={14} /> Remove selected file</button> : null}
            </div> : <label className="field field--full"><span>{kind === 'folder' ? 'Folder name' : 'Title'} <small className="required-label">Required</small></span><input aria-label={kind === 'folder' ? 'Folder name' : 'Title'} {...form.register('title')} maxLength={120} placeholder={kind === 'task' ? 'What needs to be done?' : 'Give this ' + kind + ' a clear name'} aria-invalid={Boolean(errors.title)} aria-describedby={errors.title ? 'create-title-error' : undefined} />{errors.title ? <small id="create-title-error" className="field-error" role="alert">{errors.title.message}</small> : null}</label>}
            {kind === 'folder' || kind === 'file' ? <div className="field field--full"><label htmlFor="create-folder">{kind === 'file' ? 'Destination folder' : 'Parent folder'}</label>{folders.length > 8 ? <input aria-label="Search folders" type="search" placeholder="Find a folder…" value={folderQuery} onChange={(event) => setFolderQuery(event.target.value)} /> : null}<select id="create-folder" {...form.register('parentId')}><option value="">{kind === 'file' ? 'Select a folder' : 'Top level'}</option>{folders.filter((folder) => folder.id === selectedParent || folderPath(folder.id).toLowerCase().includes(folderQuery.toLowerCase())).map((folder) => <option key={folder.id} value={folder.id}>{folderPath(folder.id)}</option>)}</select>{!folders.length && kind === 'file' ? <button type="button" className="text-button" onClick={() => chooseKind('folder')}>Create your first folder</button> : <small className="field-help">{kind === 'file' ? 'Files are stored privately and shared with your team.' : 'Use folders to organise resources by school, team, or topic.'}</small>}</div> : null}
            {kind === 'event' || kind === 'meeting' ? <>
              <div className="creation-timezone field--full">All times are Japan Standard Time (Asia/Tokyo).</div>
              <label className="field"><span>Starts</span><input type="datetime-local" aria-label="Starts" {...form.register('startDate')} aria-invalid={Boolean(errors.startDate)} aria-describedby={errors.startDate ? 'create-start-error' : undefined} />{errors.startDate ? <small id="create-start-error" className="field-error" role="alert">{errors.startDate.message}</small> : null}</label>
              <label className="field"><span>Ends</span><input type="datetime-local" aria-label="Ends" {...form.register('endDate')} aria-invalid={Boolean(errors.endDate)} aria-describedby={errors.endDate ? 'create-end-error' : undefined} />{errors.endDate ? <small id="create-end-error" className="field-error" role="alert">{errors.endDate.message}</small> : null}</label>
              <label className="field field--full"><span>Location or call link <small>Optional</small></span><input {...form.register('location')} placeholder="Meeting room or https://…" /></label>
              <fieldset className="choice-list field--full"><legend>Attendees</legend>{data.members.filter((member) => member.active).map((member) => <label key={member.id}><input type="checkbox" value={member.id} {...form.register('attendeeIds')} /><span><strong>{member.name}</strong><small>{member.organization}</small></span></label>)}</fieldset>
            </> : null}
            {kind === 'task' ? <>
              <label className="field"><span>Assignee</span><select {...form.register('assigneeId')}>{data.members.filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
              <label className="field"><span>Due date</span><input type="date" aria-label="Due date" {...form.register('dueDate')} aria-invalid={Boolean(errors.dueDate)} aria-describedby={errors.dueDate ? 'create-due-error' : undefined} />{errors.dueDate ? <small id="create-due-error" className="field-error" role="alert">{errors.dueDate.message}</small> : null}</label>
              <label className="field field--full"><span>Priority</span><select {...form.register('priority')}><option value="low">Low — when there’s time</option><option value="medium">Medium — normal priority</option><option value="high">High — needs attention</option></select></label>
              {sourceMeetingId ? <p className="field-help field--full">Action item for {data.meetings.find((meeting) => meeting.id === sourceMeetingId)?.title || 'this meeting'}.</p> : null}
            </> : null}
            {kind === 'link' ? <>
              <label className="field field--full"><span>URL</span><input type="url" {...form.register('url')} placeholder="https://example.com" aria-invalid={Boolean(errors.url)} aria-describedby={errors.url ? 'create-url-error' : undefined} />{errors.url ? <small id="create-url-error" className="field-error" role="alert">Use a complete http:// or https:// URL.</small> : null}</label>
              <label className="field field--full"><span>Category</span><input {...form.register('category')} placeholder="Operations" /></label>
            </> : null}
            {kind !== 'file' && kind !== 'folder' ? <label className="field field--full"><span>{kind === 'meeting' ? 'Agenda' : kind === 'task' ? 'Notes' : 'Description'} <small>Optional</small></span><textarea rows={3} maxLength={2000} {...form.register('description')} placeholder={kind === 'meeting' ? 'What will you discuss? Add agenda points…' : 'Add useful context for the team…'} /></label> : null}
            {['event', 'meeting', 'task'].includes(kind) && files.length ? <fieldset className="choice-list field--full"><legend>Linked files <small>Optional</small></legend>{files.map((file) => <label key={file.id}><input type="checkbox" value={file.id} {...form.register('documentIds')} /><span>{file.name}</span></label>)}</fieldset> : null}
          </fieldset>
          {submitError ? <div className="form-alert" role="alert">{submitError}</div> : null}
          <div className="form-actions creation-actions"><span className="field-help">{isSubmitting ? 'Saving securely… Please keep this window open.' : 'Ready when you are.'}</span><button type="button" className="button button--secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button><button type="submit" className="button button--primary" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle className="spin" size={17} />{kind === 'file' ? 'Uploading…' : 'Creating…'}</> : kind === 'file' ? <><Upload size={17} />Upload file</> : 'Create ' + kind}</button></div>
        </form>
      </div>
    </Modal>
  )
}
