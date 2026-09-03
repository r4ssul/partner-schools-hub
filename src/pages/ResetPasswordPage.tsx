import { useState } from 'react'
import { CheckCircle2, KeyRound, LoaderCircle } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { useAuth } from '../contexts/AuthContext'

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isInvitation = location.pathname.includes('accept-invite')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password.length < 12) { setError('Use at least 12 characters.'); return }
    if (password !== confirm) { setError('The passwords do not match.'); return }
    setSubmitting(true)
    setError(null)
    const updateError = await updatePassword(password)
    setSubmitting(false)
    if (updateError) { setError(updateError); return }
    setComplete(true)
  }
  return <div className="simple-auth"><div className="simple-auth__brand"><Brand /></div><form className="auth-form" onSubmit={submit}>{complete ? <><span className="auth-icon"><CheckCircle2 /></span><h1>{isInvitation ? 'Account activated' : 'Password updated'}</h1><p>You can now continue to your private Partner Schools Hub workspace.</p><button type="button" className="button button--primary" onClick={() => navigate('/')}>Continue to Partner Schools Hub</button></> : <><span className="auth-icon"><KeyRound /></span><h1>{isInvitation ? 'Activate your account' : 'Set your password'}</h1><p>{isInvitation ? 'Your invitation is verified. Create a strong password to enter the private workspace.' : 'Choose a strong password for your account.'}</p><label className="field"><span>New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} required disabled={submitting} /></label><label className="field"><span>Confirm password</span><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" minLength={12} required disabled={submitting} /></label>{error ? <div className="form-alert" role="alert">{error}</div> : null}<button className="button button--primary" disabled={submitting}>{submitting ? <><LoaderCircle size={16} className="spin" />Saving…</> : isInvitation ? 'Activate account' : 'Save password'}</button><Link to="/login">Back to sign in</Link></>}</form></div>
}
