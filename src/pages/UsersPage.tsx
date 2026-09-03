import { useState } from 'react'
import { Building2, MailPlus, ShieldCheck, UserMinus, UsersRound } from 'lucide-react'
import { Avatar } from '../components/Avatar'
import { Modal } from '../components/Modal'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { memberInvitationSchema } from '../lib/validation'

export default function UsersPage() {
  const { data, currentUser, inviteMember, deactivateMember } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organization, setOrganization] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const parsed = memberInvitationSchema.safeParse({ name, email, organization, jobTitle })
    if (!parsed.success) { setFormError(parsed.error.issues[0]?.message || 'Check the invitation details.'); return }
    const error = await inviteMember(parsed.data.name, parsed.data.email, parsed.data.organization, parsed.data.jobTitle)
    if (error) { setFormError(error); return }
    setName(''); setEmail(''); setOrganization(''); setJobTitle(''); setOpen(false); setMessage('Invitation created successfully.')
  }
  return (
    <div className="page feature-page">
      <div className="page-heading"><div><h1>Team access</h1><p>Invite administrators and revoke access when responsibilities change.</p></div><button className="button button--primary" onClick={() => setOpen(true)} disabled={currentUser.role !== 'owner'}><MailPlus size={18} /> Invite admin</button></div>
      {message ? <div className="toast-message" role="status">{message}<button onClick={() => setMessage(null)}>Dismiss</button></div> : null}
      <section className="content-surface"><div className="surface-toolbar"><div><h2>Workspace members</h2><span>{data.members.filter((member) => member.active).length} active</span></div><ShieldCheck size={22} /></div><div className="member-list">{data.members.map((member) => <div className={member.active ? 'member-row' : 'member-row is-inactive'} key={member.id}><Avatar member={member} /><span className="member-identity"><strong>{member.name}</strong><small className="member-organization"><Building2 size={12} /> {member.organization || 'Organisation not provided'}{member.jobTitle ? ` · ${member.jobTitle}` : ''}</small><small>{member.email}</small></span><span className={`role-label role-label--${member.role}`}>{member.role === 'owner' ? 'Super Admin' : 'Admin'}</span><span>{member.active ? 'Active' : 'Deactivated'}</span>{member.role === 'admin' && member.active ? <button className="button button--danger button--small" onClick={() => void deactivateMember(member.id).then((error) => setMessage(error || `${member.name} was deactivated.`))}><UserMinus size={16} /> Deactivate</button> : <span />}</div>)}</div></section>
      <section className="content-surface security-copy"><UsersRound size={26} /><div><h2>Access model</h2><p>The super administrator manages membership and portal settings. All active administrators can work with files, events, meetings, tasks, and links.</p></div></section>
      <Modal open={open} title="Invite an administrator" description="They will receive a secure email invitation to set their password." onClose={() => setOpen(false)}>
        <form className="form-grid" onSubmit={submit} noValidate><label className="field field--full"><span>Full name</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label><label className="field field--full"><span>Email address</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label><label className="field field--full"><span>Organisation</span><input value={organization} onChange={(event) => setOrganization(event.target.value)} placeholder="School or organisation they represent" autoComplete="organization" aria-required="true" /></label><label className="field field--full"><span>Job title</span><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Optional" autoComplete="organization-title" /></label>{formError ? <div className="form-alert" role="alert">{formError}</div> : null}<div className="form-actions"><button type="button" className="button button--secondary" onClick={() => { setOpen(false); setFormError(null) }}>Cancel</button><button className="button button--primary">Send invitation</button></div></form>
      </Modal>
    </div>
  )
}
