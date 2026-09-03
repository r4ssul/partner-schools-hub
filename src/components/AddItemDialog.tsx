import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { CalendarDays, CheckSquare2, FileText, FolderPlus, Link2, Upload, UsersRound } from 'lucide-react'
import { format } from 'date-fns'
import { createItemSchema } from '../lib/validation'
import type { EntityKind, NewItemInput } from '../types'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { Modal } from './Modal'

const choices: Array<{ kind: EntityKind; label: string; icon: typeof FileText }> = [
  { kind: 'file', label: 'Upload file', icon: Upload },
  { kind: 'folder', label: 'New folder', icon: FolderPlus },
  { kind: 'event', label: 'Event', icon: CalendarDays },
  { kind: 'meeting', label: 'Meeting', icon: UsersRound },
  { kind: 'task', label: 'Task', icon: CheckSquare2 },
  { kind: 'link', label: 'Quick link', icon: Link2 },
]

export function AddItemDialog({ open, initialKind = 'task', sourceMeetingId = null, onClose }: { open: boolean; initialKind?: EntityKind; sourceMeetingId?: string | null; onClose: () => void }) {
  const { data, currentUser, addItem, uploadFile } = useWorkspace()
  const [kind, setKind] = useState<EntityKind>(initialKind)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const now = new Date()
  const form = useForm<NewItemInput>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      kind: initialKind,
      title: '',
      description: '',
      startDate: format(now, "yyyy-MM-dd'T'HH:mm"),
      endDate: format(new Date(now.getTime() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
      dueDate: format(now, 'yyyy-MM-dd'),
      priority: 'medium',
      assigneeId: currentUser.id,
      category: 'General',
      parentId: null,
      attendeeIds: [currentUser.id],
      documentIds: [],
      sourceMeetingId,
    },
  })

  const chooseKind = (next: EntityKind) => {
    setKind(next)
    form.setValue('kind', next)
    setSubmitError(null)
  }

  const submit = form.handleSubmit(async (values) => {
    setSubmitError(null)
    if (kind === 'file') {
      const file = selectedFile
      if (!file) { setSubmitError('Choose a file to upload.'); return }
      if (!values.parentId) { setSubmitError('Choose a destination folder.'); return }
      const uploadError = await uploadFile(file, values.parentId)
      if (uploadError) { setSubmitError(uploadError); return }
    } else {
      await addItem({ ...values, kind, sourceMeetingId })
    }
    form.reset()
    onClose()
  })

  return (
    <Modal open={open} title="Add new" description="Create something for your team workspace." onClose={onClose} size="lg">
      <div className="creation-layout">
        <div className="creation-types" role="tablist" aria-label="Item type">
          {choices.map(({ kind: choiceKind, label, icon: Icon }) => (
            <button key={choiceKind} type="button" role="tab" aria-selected={kind === choiceKind} className={kind === choiceKind ? 'creation-type is-active' : 'creation-type'} onClick={() => chooseKind(choiceKind)}>
              <Icon size={19} /><span>{label}</span>
            </button>
          ))}
        </div>
        <form className="form-grid" onSubmit={submit} noValidate>
          {kind === 'file' ? (
            <>
              <label className="field field--full"><span>File</span><input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.gif,.txt,.csv" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} /></label>
              <label className="field field--full"><span>Folder</span><select {...form.register('parentId')}><option value="">Select a folder</option>{data.folders.filter((folder) => !folder.deletedAt).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label>
            </>
          ) : (
            <label className="field field--full"><span>{kind === 'folder' ? 'Folder name' : 'Title'}</span><input {...form.register('title')} placeholder={kind === 'task' ? 'What needs to be done?' : `New ${kind} title`} />{form.formState.errors.title ? <small className="field-error">{form.formState.errors.title.message}</small> : null}</label>
          )}
          {kind === 'folder' ? <label className="field field--full"><span>Parent folder</span><select {...form.register('parentId')}><option value="">Top level</option>{data.folders.filter((folder) => !folder.deletedAt).map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}</select></label> : null}
          {kind === 'event' || kind === 'meeting' ? (
            <>
              <label className="field"><span>Starts</span><input type="datetime-local" {...form.register('startDate')} />{form.formState.errors.startDate ? <small className="field-error">{form.formState.errors.startDate.message}</small> : null}</label>
              <label className="field"><span>Ends</span><input type="datetime-local" {...form.register('endDate')} /></label>
              <label className="field field--full"><span>Location or call link</span><input {...form.register('location')} placeholder="Conference room A" /></label>
              <label className="field"><span>Attendees</span><select multiple size={Math.min(4, data.members.filter((member) => member.active).length)} {...form.register('attendeeIds')}>{data.members.filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select><small className="field-help">Use Ctrl/Cmd to choose more than one.</small></label>
              <label className="field"><span>Linked files</span><select multiple size={Math.min(4, data.documents.filter((document) => !document.deletedAt).length)} {...form.register('documentIds')}>{data.documents.filter((document) => !document.deletedAt).map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}</select></label>
            </>
          ) : null}
          {kind === 'task' ? (
            <>
              <label className="field"><span>Assignee</span><select {...form.register('assigneeId')}>{data.members.filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
              <label className="field"><span>Due date</span><input type="date" {...form.register('dueDate')} />{form.formState.errors.dueDate ? <small className="field-error">{form.formState.errors.dueDate.message}</small> : null}</label>
              <label className="field field--full"><span>Priority</span><select {...form.register('priority')}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            </>
          ) : null}
          {kind === 'link' ? (
            <>
              <label className="field"><span>URL</span><input type="url" {...form.register('url')} placeholder="https://" />{form.formState.errors.url ? <small className="field-error">{form.formState.errors.url.message}</small> : null}</label>
              <label className="field"><span>Category</span><input {...form.register('category')} placeholder="Operations" /></label>
            </>
          ) : null}
          {kind !== 'file' && kind !== 'folder' ? <label className="field field--full"><span>{kind === 'meeting' ? 'Agenda' : kind === 'task' ? 'Notes' : 'Description'}</span><textarea rows={4} {...form.register('description')} /></label> : null}
          {submitError ? <div className="form-alert" role="alert">{submitError}</div> : null}
          <div className="form-actions"><button type="button" className="button button--secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button--primary">{kind === 'file' ? 'Upload file' : `Create ${kind}`}</button></div>
        </form>
      </div>
    </Modal>
  )
}
