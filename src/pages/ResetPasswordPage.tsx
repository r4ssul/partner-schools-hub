import { useState } from 'react'
import { CheckCircle2, KeyRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { useAuth } from '../contexts/AuthContext'

export default function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [complete, setComplete] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password.length < 12) { setError('Use at least 12 characters.'); return }
    if (password !== confirm) { setError('The passwords do not match.'); return }
    const updateError = await updatePassword(password)
    if (updateError) { setError(updateError); return }
    setComplete(true)
  }
  return <div className="simple-auth"><div className="simple-auth__brand"><Brand /></div><form className="auth-form" onSubmit={submit}>{complete ? <><span className="auth-icon"><CheckCircle2 /></span><h1>Password updated</h1><p>You can now continue to your private workspace.</p><button type="button" className="button button--primary" onClick={() => navigate('/')}>Continue to Partner Schools Hub</button></> : <><span className="auth-icon"><KeyRound /></span><h1>Set your password</h1><p>Choose a strong password for your invited account.</p><label className="field"><span>New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" /></label><label className="field"><span>Confirm password</span><input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" /></label>{error ? <div className="form-alert" role="alert">{error}</div> : null}<button className="button button--primary">Save password</button><Link to="/login">Back to sign in</Link></>}</form></div>
}
