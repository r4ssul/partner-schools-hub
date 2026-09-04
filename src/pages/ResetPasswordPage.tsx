import { useState } from 'react'
import { CheckCircle2, KeyRound, LoaderCircle, ShieldAlert } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { useAuth } from '../contexts/AuthContext'

export default function ResetPasswordPage() {
  const { user, loading, passwordSetup, authError, updatePassword, signOut, refreshPasswordSetup } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isInvitation = location.pathname.includes('accept-invite')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const leaveSetup = async () => {
    setSubmitting(true)
    try { await signOut(); navigate('/login', { replace: true }) }
    catch { setError('Unable to sign out. Please try again.'); setSubmitting(false) }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user || loading || passwordSetup === 'checking' || passwordSetup === 'error') { setError('Verify your invitation before setting a password.'); return }
    if (password.length < 12) { setError('Use at least 12 characters.'); return }
    if (password !== confirm) { setError('The passwords do not match.'); return }
    setSubmitting(true)
    setError(null)
    const updateError = await updatePassword(password)
    setSubmitting(false)
    if (updateError) { setError(updateError); return }
    setComplete(true)
  }
  let content: React.ReactNode
  if (loading || (user && passwordSetup === 'checking')) {
    content = <div role="status"><LoaderCircle className="spin" /><h1>Verifying your account…</h1><p>Please wait while we check your secure link.</p></div>
  } else if (authError || !user) {
    content = <><span className="auth-icon"><ShieldAlert /></span><h1>Open a valid setup link</h1><p role="alert">{authError || 'This page needs a valid invitation or password-reset link. The link may have expired or already been used.'}</p><p>Ask the person who invited you for a new link, or use “Forgot password?” on the sign-in page.</p>{user ? <button className="button button--secondary" type="button" disabled={submitting} onClick={() => void leaveSetup()}>Back to sign in</button> : <Link to="/login">Back to sign in</Link>}</>
  } else if (passwordSetup === 'error') {
    content = <><h1>Verification unavailable</h1><p role="alert">We couldn’t verify your account. Workspace access stays locked until this check succeeds.</p><button className="button button--primary" type="button" onClick={() => void refreshPasswordSetup()}>Try again</button><button className="text-button" type="button" onClick={() => void leaveSetup()}>Sign out</button></>
  } else if (complete || (isInvitation && passwordSetup === 'complete')) {
    content = <><span className="auth-icon"><CheckCircle2 /></span><h1>{complete ? isInvitation ? 'Account activated' : 'Password updated' : 'Your account is already active'}</h1><p>You can now continue to your private Partner Schools Hub workspace.</p><button type="button" className="button button--primary" onClick={() => navigate('/', { replace: true })}>Continue to Partner Schools Hub</button></>
  } else {
    content = <><span className="auth-icon"><KeyRound /></span><h1>{isInvitation ? 'Activate your account' : 'Set your password'}</h1><p>{isInvitation ? 'Your email is verified. Set a password to finish activating your account. Until then, your workspace remains locked.' : 'Choose a strong password for your account.'}</p><p className="field-help">{user.email}</p><label className="field"><span>New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required disabled={submitting} aria-describedby="password-guidance" /></label><small id="password-guidance" className="field-help">Use at least 12 characters.</small><label className="field"><span>Confirm password</span><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={12} required disabled={submitting} /></label>{error ? <div className="form-alert" role="alert">{error}</div> : null}<button className="button button--primary" disabled={submitting}>{submitting ? <><LoaderCircle size={16} className="spin" />Saving…</> : isInvitation ? 'Activate account' : 'Save password'}</button><button className="text-button" type="button" disabled={submitting} onClick={() => void leaveSetup()}>Back to sign in</button></>
  }
  return <main className="simple-auth"><div className="simple-auth__brand"><Brand /></div><form className="auth-form" onSubmit={submit}>{content}</form></main>
}
