import { useState } from 'react'
import { Building2, Info, LoaderCircle, MailPlus, ShieldCheck, Trash2, UserMinus, UsersRound } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { Modal } from '../components/Modal'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { ACCESS_MODEL_TEXT, canDeactivateMember, canDeleteFormerMember, canManageMembership, memberRoleLabel } from '../lib/policies'
import { memberInvitationSchema } from '../lib/validation'
import type { InvitableMemberRole, Member } from '../types'

export default function UsersPage() {
  const { data, currentUser, inviteMember, deactivateMember, deleteFormerMember } = useWorkspace()
  const canManage = canManageMembership(currentUser.role)
  const [view, setView] = useState<'active' | 'former'>('active')
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const visibleMembers = data.members.filter((member) => member.active === (!canManage || view === 'active'))
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const role: InvitableMemberRole = 'admin'
  const [message, setMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setEmail('')
    setOrganization('')
    setJobTitle('')
    setFormError(null)
  }

  const closeInvite = () => {
    if (submitting) return
    setOpen(false)
    setFormError(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const parsed = memberInvitationSchema.safeParse({ name, email, organization, jobTitle, role })
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Check the invitation details.')
      return
    }
    setSubmitting(true)
    const error = await inviteMember(parsed.data.name, parsed.data.email, parsed.data.organization, parsed.data.jobTitle, parsed.data.role)
    setSubmitting(false)
    if (error) {
      setFormError(error)
      return
    }
    resetForm()
    setOpen(false)
    setMessage(`Invitation sent to ${parsed.data.email}.`)
  }

  const deactivate = async (memberId: string, memberName: string) => {
    setDeactivatingId(memberId)
    const error = await deactivateMember(memberId)
    setDeactivatingId(null)
    setMessage(error || `${memberName} was deactivated.`)
    if (!error) setView('former')
  }

  const closeDelete = () => {
    if (deleting) return
    setDeleteTarget(null); setConfirmEmail(''); setDeleteError(null)
  }
  const removeMember = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!deleteTarget || deleting) return
    setDeleting(true); setDeleteError(null)
    try {
      const result = await deleteFormerMember(deleteTarget.id, confirmEmail)
      if (result.error) { setDeleteError(result.error); return }
      setMessage(result.warning || `${deleteTarget.name}'s account was permanently deleted. You can invite ${deleteTarget.email} again.`)
      setDeleteTarget(null); setConfirmEmail('')
    } catch { setDeleteError('Unable to delete this account. Check your connection and try again.') }
    finally { setDeleting(false) }
  }

  return (
    <div className="page feature-page">
      <div className="page-heading">
        <div><h1>{canManage ? 'Team access' : 'Team directory'}</h1><p>{canManage ? 'Invite administrators and manage access to this private workspace.' : 'Get to know the people in your workspace. This directory is read-only.'}</p></div>
        {canManage ? <button className="button button--primary" onClick={() => setOpen(true)}><MailPlus size={18} /> Invite team member</button> : null}
      </div>
      {message ? <div className={message.startsWith('Invitation sent') || message.endsWith('deactivated.') ? 'toast-message is-success' : 'toast-message'} role="status">{message}<button onClick={() => setMessage(null)}>Dismiss</button></div> : null}
      <section className="content-surface">
        <div className="surface-toolbar team-toolbar"><div><h2>{canManage && view === 'former' ? 'Former members' : 'Workspace members'}</h2><span>{visibleMembers.length} {canManage && view === 'former' ? 'deactivated accounts' : 'active members'}</span></div>{canManage ? <div className="segmented-control" aria-label="Team view"><button className={view === 'active' ? 'is-active' : ''} aria-pressed={view === 'active'} onClick={() => setView('active')}>Active team</button><button className={view === 'former' ? 'is-active' : ''} aria-pressed={view === 'former'} onClick={() => setView('former')}>Former members</button></div> : <ShieldCheck size={22} />}</div>
        {canManage && view === 'former' ? <p className="former-member-note">Deactivation blocks access but keeps the account registered. The Web. Developer can permanently delete a former account to free its email for a new invitation. Shared content and audit history are retained.</p> : null}
        <div className="member-list">{visibleMembers.map((member) => (
          <div className={member.active ? 'member-row' : 'member-row is-inactive'} key={member.id}>
            <Avatar member={member} />
            <span className="member-identity"><strong>{member.name}{member.id === currentUser.id ? <small className="you-label">You</small> : null}</strong><small className="member-organization"><Building2 size={12} /> {member.organization || 'Organisation not provided'}{member.jobTitle ? ` · ${member.jobTitle}` : ''}</small><small className="member-email">{member.email}</small></span>
            <span className={`role-label role-label--${member.role}`}>{memberRoleLabel(member.role, member.email)}</span>
            <span className={member.active ? 'member-status is-active' : 'member-status'}>{member.active ? 'Active' : 'Deactivated'}</span>
            {canDeactivateMember(currentUser.role, member, data.members) ? <button className="button button--danger button--small" disabled={deactivatingId === member.id} onClick={() => void deactivate(member.id, member.name)}>{deactivatingId === member.id ? <LoaderCircle className="spin" size={16} /> : <UserMinus size={16} />} {deactivatingId === member.id ? 'Deactivating' : 'Deactivate'}</button> : canDeleteFormerMember(currentUser, member) ? <button className="button button--danger button--small" onClick={() => { setDeleteTarget(member); setConfirmEmail(''); setDeleteError(null) }}><Trash2 size={16} /> Delete account</button> : <span />}
          </div>
        ))}</div>
        {!visibleMembers.length ? <div className="empty-state"><UsersRound size={32} /><h3>No {view === 'former' && canManage ? 'former members' : 'team members'} here</h3><p>{view === 'former' && canManage ? 'Deactivated accounts will appear here.' : 'Your team will appear here as people join.'}</p></div> : null}
      </section>
      <section className="content-surface security-copy"><UsersRound size={26} /><div><h2>Access model</h2><p>{ACCESS_MODEL_TEXT}</p></div></section>
      <Modal open={open} title="Invite a team member" description="Invite them to this private workspace with a secure activation link." onClose={closeInvite}>
        <form className="form-grid invite-form" onSubmit={submit} noValidate aria-busy={submitting}>
          <label className="field field--full"><span>Full name</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" autoFocus /></label>
          <label className="field field--full"><span>Work email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          <label className="field"><span>Organisation</span><input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="School or organisation" autoComplete="organization" aria-required="true" /></label>
          <label className="field"><span>Job title</span><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Optional" autoComplete="organization-title" /></label>
          <div className="field field--full"><span>Access level</span><p className="field-help">Admin — shared files, calendar, meetings, tasks, links, and chat.</p></div>
          <aside className="invitation-preview field--full" aria-label="Invitation email summary"><Info size={19} /><div><strong>What the invitation says</strong><p><b>{currentUser.name}</b> from <b>{currentUser.organization || data.settings.name}</b> invited {name.trim() || 'this person'} to join <b>{data.settings.name}</b> for {organization.trim() || 'their organisation'}.</p><p>The email identifies the private workspace, explains the {memberRoleLabel(role)} access, and includes a secure one-hour activation link to set a password.</p></div></aside>
          {formError ? <div className="form-alert" role="alert">{formError}</div> : null}
          <div className="form-actions"><button type="button" className="button button--secondary" onClick={closeInvite} disabled={submitting}>Cancel</button><button className="button button--primary" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" size={17} /> Sending invitation</> : <><MailPlus size={17} /> Send invitation</>}</button></div>
        </form>
      </Modal>
      <Modal open={Boolean(deleteTarget)} title="Permanently delete this account?" description="This removes the former member’s login, profile, team membership, and private account records from the database." onClose={closeDelete} size="sm">
        <form className="confirm-dialog destructive-confirm" onSubmit={removeMember} aria-busy={deleting}>
          <p><strong>{deleteTarget?.name}</strong> · {deleteTarget?.email}</p>
          <p>Shared files, events, meetings, tasks, messages, and audit history stay. Author references become “Former member”; assigned tasks become unassigned. This cannot be undone, but the email can be invited again as a new account.</p>
          <label className="field"><span>Type the member’s email to confirm</span><input type="email" value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} autoComplete="off" autoFocus disabled={deleting} required /></label>
          {deleteError ? <div className="form-alert" role="alert">{deleteError}</div> : null}
          <div className="modal-footer"><button type="button" className="button button--secondary" onClick={closeDelete} disabled={deleting}>Cancel</button><button className="button button--danger" disabled={deleting || !deleteTarget?.email || confirmEmail.trim().toLowerCase() !== deleteTarget.email.toLowerCase()}>{deleting ? <><LoaderCircle size={17} className="spin" />Deleting…</> : 'Delete permanently'}</button></div>
        </form>
      </Modal>
    </div>
  )
}
