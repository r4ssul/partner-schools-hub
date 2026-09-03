import { useState } from 'react'
import { Bell, Building2, Check, Database, KeyRound, RefreshCw, ShieldCheck, UserRound } from 'lucide-react'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { memberProfileSchema } from '../lib/validation'
import { isLocalPreviewEnabled } from '../lib/runtime'
import { isSupabaseConfigured } from '../lib/supabase'
import { canManageWorkspace } from '../lib/policies'
import type { Member } from '../types'

function PersonalInformationCard({ currentUser, saved, onSaved }: { currentUser: Member; saved: boolean; onSaved: () => void }) {
  const { updateProfile } = useWorkspace()
  const [profile, setProfile] = useState({ name: currentUser.name, organization: currentUser.organization, jobTitle: currentUser.jobTitle, phone: currentUser.phone })
  const [profileError, setProfileError] = useState<string | null>(null)
  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    setProfileError(null)
    const parsed = memberProfileSchema.safeParse(profile)
    if (!parsed.success) { setProfileError(parsed.error.issues[0]?.message || 'Check your profile details.'); return }
    const error = await updateProfile(parsed.data)
    if (error) { setProfileError(error); return }
    setProfile(parsed.data)
    onSaved()
  }
  return <form className="content-surface settings-card settings-card--profile" onSubmit={saveProfile} noValidate><header><UserRound size={22} /><div><h2>Personal information</h2><p>Control the details shown to other administrators in this workspace.</p></div></header><div className="profile-fields"><label className="field"><span>Full name</span><input value={profile.name} onChange={(event) => setProfile((value) => ({ ...value, name: event.target.value }))} autoComplete="name" /></label><label className="field"><span>Email address</span><input value={currentUser.email} readOnly aria-describedby="profile-email-help" autoComplete="email" /><small id="profile-email-help" className="field-help">Managed by your secure sign-in account.</small></label><label className="field"><span>Organisation</span><input value={profile.organization} onChange={(event) => setProfile((value) => ({ ...value, organization: event.target.value }))} placeholder="School or organisation" autoComplete="organization" aria-required="true" /></label><label className="field"><span>Job title</span><input value={profile.jobTitle} onChange={(event) => setProfile((value) => ({ ...value, jobTitle: event.target.value }))} placeholder="e.g. Head of School" autoComplete="organization-title" /></label><label className="field"><span>Phone number</span><input type="tel" value={profile.phone} onChange={(event) => setProfile((value) => ({ ...value, phone: event.target.value }))} placeholder="Optional" autoComplete="tel" /></label></div>{profileError ? <div className="form-alert settings-form-alert" role="alert">{profileError}</div> : null}<button className="button button--primary settings-save-button">{saved ? <><Check size={17} /> Saved</> : 'Save personal information'}</button></form>
}

export default function SettingsPage() {
  const { data, currentUser, updateSettings, resetLocalPreview } = useWorkspace()
  const [name, setName] = useState(data.settings.name)
  const [emails, setEmails] = useState(data.settings.emailNotifications)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedSection, setSavedSection] = useState<'profile' | 'workspace' | 'notifications' | null>(null)
  const showSaved = (section: 'profile' | 'workspace' | 'notifications') => {
    setSavedSection(section)
    window.setTimeout(() => setSavedSection(null), 2000)
  }
  const saveWorkspace = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaveError(null)
    try { await updateSettings(name, data.settings.emailNotifications); showSaved('workspace') }
    catch (reason) { setSaveError((reason as Error).message || 'Unable to save workspace settings.') }
  }
  const saveNotifications = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaveError(null)
    try { await updateSettings(data.settings.name, emails); showSaved('notifications') }
    catch (reason) { setSaveError((reason as Error).message || 'Unable to save notification settings.') }
  }
  return (
    <div className="page feature-page settings-page">
      <div className="page-heading"><div><h1>Settings</h1><p>Workspace identity, notifications and account security.</p></div></div>
      {saveError ? <div className="form-alert" role="alert">{saveError}</div> : null}
      <div className="settings-grid">
        <PersonalInformationCard key={`${currentUser.id}:${currentUser.name}:${currentUser.organization}:${currentUser.jobTitle}:${currentUser.phone}`} currentUser={currentUser} saved={savedSection === 'profile'} onSaved={() => showSaved('profile')} />
        <form className="content-surface settings-card" onSubmit={saveWorkspace}><header><Building2 size={22} /><div><h2>Workspace</h2><p>Basic details used throughout the portal.</p></div></header><label className="field"><span>Workspace name</span><input value={name} onChange={(event) => setName(event.target.value)} disabled={!canManageWorkspace(currentUser.role)} /></label><label className="field"><span>Workspace timezone</span><input value="Asia/Tokyo" disabled /></label><button className="button button--primary" disabled={!canManageWorkspace(currentUser.role)}>{savedSection === 'workspace' ? <><Check size={17} /> Saved</> : 'Save workspace'}</button></form>
        <form className="content-surface settings-card" onSubmit={saveNotifications}><header><Bell size={22} /><div><h2>Notifications</h2><p>Choose where operational reminders are delivered.</p></div></header><label className="toggle-row"><span><strong>Email notifications</strong><small>Assignments, schedule changes and 24-hour reminders.</small></span><input type="checkbox" checked={emails} onChange={(event) => setEmails(event.target.checked)} /></label><label className="toggle-row"><span><strong>In-app notifications</strong><small>Required for collaboration updates.</small></span><input type="checkbox" checked disabled /></label><button className="button button--primary settings-save-button">{savedSection === 'notifications' ? <><Check size={17} /> Saved</> : 'Save notifications'}</button></form>
        <section className="content-surface settings-card"><header><ShieldCheck size={22} /><div><h2>Account security</h2><p>Your access is private and individually assigned.</p></div></header><div className="settings-status"><KeyRound size={18} /><span><strong>Password protected</strong><small>{isLocalPreviewEnabled ? 'Showcase access uses the temporary demonstration account.' : `Password resets are sent to ${currentUser.email}.`}</small></span></div><div className="settings-status"><Database size={18} /><span><strong>{isSupabaseConfigured ? 'Shared workspace connected' : isLocalPreviewEnabled ? 'Browser-local showcase storage' : 'Configuration required'}</strong><small>{isSupabaseConfigured ? 'Database and files are protected by workspace policies.' : isLocalPreviewEnabled ? 'Demo records stay only in this browser and are not shared with other visitors.' : 'Add Supabase environment variables before deploying.'}</small></span></div>{isLocalPreviewEnabled ? <button className="button button--secondary" onClick={resetLocalPreview}><RefreshCw size={17} /> Clear showcase data</button> : null}</section>
      </div>
    </div>
  )
}
