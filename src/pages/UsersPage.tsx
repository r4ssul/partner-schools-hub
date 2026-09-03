import { useState } from 'react'
import { Building2, Info, LoaderCircle, MailPlus, ShieldCheck, UserMinus, UsersRound } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { Modal } from '../components/Modal'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { memberRoleLabel } from '../lib/policies'
import { memberInvitationSchema } from '../lib/validation'
import type { InvitableMemberRole } from '../types'

export default function UsersPage() {
  const { data, currentUser, inviteMember, deactivateMember } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [role, setRole] = useState<InvitableMemberRole>('admin')
  const [message, setMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setEmail('')
    setOrganization('')
    setJobTitle('')
    setRole('admin')
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
  }

  return (
    <div className="page feature-page">
      <div className="page-heading">
        <div><h1>Team access</h1><p>Invite administrators and manage access to this private workspace.</p></div>
        <button className="button button--primary" onClick={() => setOpen(true)}><MailPlus size={18} /> Invite team member</button>
      </div>
      {message ? <div className={message.startsWith('Invitation sent') || message.endsWith('deactivated.') ? 'toast-message is-success' : 'toast-message'} role="status">{message}<button onClick={() => setMessage(null)}>Dismiss</button></div> : null}
      <section className="content-surface">
        <div className="surface-toolbar"><div><h2>Workspace members</h2><span>{data.members.filter((member) => member.active).length} active · {data.members.length} total</span></div><ShieldCheck size={22} /></div>
        <div className="member-list">{data.members.map((member) => (
          <div className={member.active ? 'member-row' : 'member-row is-inactive'} key={member.id}>
            <Avatar member={member} />
            <span className="member-identity"><strong>{member.name}{member.id === currentUser.id ? <small className="you-label">You</small> : null}</strong><small className="member-organization"><Building2 size={12} /> {member.organization || 'Organisation not provided'}{member.jobTitle ? ` · ${member.jobTitle}` : ''}</small><small className="member-email">{member.email}</small></span>
            <span className={`role-label role-label--${member.role}`}>{memberRoleLabel(member.role)}</span>
            <span className={member.active ? 'member-status is-active' : 'member-status'}>{member.active ? 'Active' : 'Deactivated'}</span>
            {member.role !== 'owner' && member.active ? <button className="button button--danger button--small" disabled={deactivatingId === member.id} onClick={() => void deactivate(member.id, member.name)}>{deactivatingId === member.id ? <LoaderCircle className="spin" size={16} /> : <UserMinus size={16} />} {deactivatingId === member.id ? 'Deactivating' : 'Deactivate'}</button> : <span />}
          </div>
        ))}</div>
      </section>
      <section className="content-surface security-copy"><UsersRound size={26} /><div><h2>Access model</h2><p>The owner manages invitations and workspace settings. Super admins can work with all shared content and review or clear activity logs. Admins can manage day-to-day content.</p></div></section>
      <Modal open={open} title="Invite a team member" description="They will receive a branded email with a secure activation link." onClose={closeInvite}>
        <form className="form-grid invite-form" onSubmit={submit} noValidate aria-busy={submitting}>
          <label className="field field--full"><span>Full name</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" autoFocus /></label>
          <label className="field field--full"><span>Work email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
          <label className="field"><span>Organisation</span><input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="School or organisation" autoComplete="organization" aria-required="true" /></label>
          <label className="field"><span>Job title</span><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Optional" autoComplete="organization-title" /></label>
          <label className="field field--full"><span>Role</span><select value={role} onChange={(event) => setRole(event.target.value as InvitableMemberRole)}><option value="admin">Admin — manage shared content</option><option value="super_admin">Super Admin — content and activity logs</option></select></label>
          <aside className="invitation-preview field--full" aria-label="Invitation email summary"><Info size={19} /><div><strong>What the invitation says</strong><p><b>{currentUser.name}</b> from <b>{currentUser.organization || data.settings.name}</b> invited {name.trim() || 'this person'} to join <b>{data.settings.name}</b> for {organization.trim() || 'their organisation'}.</p><p>The email identifies the private workspace, explains the {memberRoleLabel(role)} access, and includes a secure one-hour activation link to set a password.</p></div></aside>
          {formError ? <div className="form-alert" role="alert">{formError}</div> : null}
          <div className="form-actions"><button type="button" className="button button--secondary" onClick={closeInvite} disabled={submitting}>Cancel</button><button className="button button--primary" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" size={17} /> Sending invitation</> : <><MailPlus size={17} /> Send invitation</>}</button></div>
        </form>
      </Modal>
    </div>
  )
}
