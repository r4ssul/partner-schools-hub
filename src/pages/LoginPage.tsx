import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, Mail } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Brand } from '../components/Brand'
import { useAuth } from '../contexts/AuthContext'
import { loginSchema } from '../lib/validation'

type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const { user, signIn, requestPasswordReset, localPreviewMode, previewEmail } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: localPreviewMode ? previewEmail : '', password: '' },
  })
  if (user) return <Navigate to="/" replace />

  const submit = form.handleSubmit(async (values) => {
    setError(null)
    const signInError = await signIn(values.email, values.password)
    if (signInError) { setError(signInError); return }
    navigate('/')
  })

  const reset = async () => {
    const email = form.getValues('email')
    const result = z.string().email().safeParse(email)
    if (!result.success) { form.setError('email', { message: 'Enter your email first' }); return }
    const resetError = await requestPasswordReset(email)
    if (resetError) { setError(resetError); return }
    setResetSent(true)
  }

  return (
    <div className="auth-page">
      <section className="auth-brand-panel">
        <Brand />
        <div>
          <h1>Your partnership, organized.</h1>
          <p>Files, plans, meetings and follow-ups in one private workspace.</p>
          <ul>
            <li><CheckCircle2 /> Invite-only access</li>
            <li><CheckCircle2 /> Protected school files</li>
            <li><CheckCircle2 /> Shared events and ownership</li>
          </ul>
        </div>
        <span><LockKeyhole size={18} /> Authorized team members only</span>
      </section>
      <main className="auth-form-panel">
        <div className="auth-mobile-brand"><Brand /></div>
        <form className="auth-form" onSubmit={submit} noValidate>
          <span className="auth-icon"><KeyRound /></span>
          <h2>Welcome back</h2>
          <p>Sign in to continue to Partner Schools Hub.</p>
          {localPreviewMode ? <div className="demo-callout">Showcase mode is active. Your demo data stays only in this browser until the shared workspace is connected.</div> : null}
          <label className="field">
            <span>Email address</span>
            <div className="input-with-icon"><Mail size={18} /><input type="email" autoComplete="email" {...form.register('email')} /></div>
            {form.formState.errors.email ? <small className="field-error">{form.formState.errors.email.message}</small> : null}
          </label>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <div className="input-with-icon">
              <LockKeyhole size={18} />
              <input id="login-password" type={passwordVisible ? 'text' : 'password'} autoComplete="current-password" {...form.register('password')} />
              <button type="button" className="password-visibility" onClick={() => setPasswordVisible((visible) => !visible)} aria-label={passwordVisible ? 'Hide password' : 'Show password'}>{passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            {form.formState.errors.password ? <small className="field-error">{form.formState.errors.password.message}</small> : null}
          </div>
          <button type="button" className="text-button auth-reset" onClick={() => void reset()}>Forgot password?</button>
          {resetSent ? <div className="form-alert is-success">If an account exists, a reset email is on its way.</div> : null}
          {error ? <div className="form-alert" role="alert">{error}</div> : null}
          <button className="button button--primary button--large" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? 'Signing in…' : 'Sign in'} <ArrowRight size={18} /></button>
          <small className="auth-footnote">Accounts are created by invitation only. Contact your super administrator if you need access.</small>
        </form>
      </main>
    </div>
  )
}
