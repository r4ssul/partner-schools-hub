/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { isLocalPreviewEnabled } from '../lib/runtime'
import { INITIAL_SUPER_ADMIN_EMAIL } from '../lib/identity'

interface AuthUser {
  id: string
  email: string
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  passwordSetup: 'checking' | 'required' | 'complete' | 'error'
  authError: string | null
  refreshPasswordSetup: () => Promise<boolean>
  localPreviewMode: boolean
  previewEmail: string
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const LOCAL_SESSION_KEY = 'partner-schools-hub:preview-session'
const previewEmail = (import.meta.env.VITE_PREVIEW_LOGIN_EMAIL as string | undefined)?.trim() || INITIAL_SUPER_ADMIN_EMAIL
const previewPassword = (import.meta.env.VITE_PREVIEW_LOGIN_PASSWORD as string | undefined) || ''
const LOCAL_PREVIEW_USER: AuthUser = { id: previewEmail.toLowerCase() === INITIAL_SUPER_ADMIN_EMAIL ? 'rassul-abzhapparov' : 'jan-baloglu', email: previewEmail }

function loadPreviewSession() {
  if (!isLocalPreviewEnabled) return null
  return sessionStorage.getItem(LOCAL_SESSION_KEY) === 'authenticated' ? LOCAL_PREVIEW_USER : null
}

function mapSession(session: Session | null): AuthUser | null {
  if (!session?.user.email) return null
  return { id: session.user.id, email: session.user.email }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadPreviewSession)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [authError, setAuthError] = useState<string | null>(null)
  const [activation, setActivation] = useState<{ userId: string; status: 'required' | 'complete' | 'error' } | null>(null)
  const [activationRevision, setActivationRevision] = useState(0)
  const userId = user?.id
  const passwordSetup: AuthContextValue['passwordSetup'] = !supabase || !userId ? 'complete' : activation?.userId === userId ? activation.status : 'checking'

  const refreshPasswordSetup = useCallback(async () => {
    if (!supabase) return isLocalPreviewEnabled
    if (!userId) return false
    try {
      const { data, error } = await supabase.rpc('has_completed_password_setup')
      if (error) throw error
      setActivation({ userId, status: data === true ? 'complete' : 'required' })
      return data === true
    } catch {
      setActivation({ userId, status: 'error' })
      return false
    }
  }, [userId])

  useEffect(() => {
    if (!supabase || !userId) return
    let active = true
    // Never await a Supabase request inside onAuthStateChange: it holds the
    // Auth lock. Verify the server-owned password state after that callback.
    void supabase.rpc('has_completed_password_setup').then(({ data, error }) => {
      if (active) setActivation({ userId, status: error ? 'error' : data === true ? 'complete' : 'required' })
    }, () => { if (active) setActivation({ userId, status: 'error' }) })
    return () => { active = false }
  }, [userId, activationRevision])

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active) {
        if (error) setAuthError('This link is invalid or has expired. Request a new invitation or password-reset email.')
        setUser((previous) => previous?.id === data.session?.user.id ? previous : mapSession(data.session))
        setLoading(false)
      }
    }, () => {
      if (active) { setAuthError('Unable to verify your session. Please sign in again.'); setLoading(false) }
    })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return
      setUser((previous) => previous?.id === session?.user.id && previous?.email === session?.user.email ? previous : mapSession(session))
      if (event === 'SIGNED_OUT') setActivation(null)
      if (event === 'USER_UPDATED') { setActivation(null); setActivationRevision((value) => value + 1) }
      setLoading(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setAuthError(null)
    if (!supabase) {
      if (isLocalPreviewEnabled) {
        if (!previewPassword) return 'Local preview login is not configured.'
        if (email.trim().toLowerCase() !== previewEmail.toLowerCase() || password !== previewPassword) return 'Incorrect email or password.'
        sessionStorage.setItem(LOCAL_SESSION_KEY, 'authenticated')
        setUser(LOCAL_PREVIEW_USER)
        return null
      }
      return 'Supabase is not configured for this deployment.'
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error?.message ?? null
  }, [])

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut({ scope: 'local' })
    sessionStorage.removeItem(LOCAL_SESSION_KEY)
    setUser(null)
    setActivation(null)
    setAuthError(null)
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase) return isLocalPreviewEnabled ? 'Password recovery is unavailable in showcase mode.' : 'Password recovery is unavailable until Supabase is configured.'
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL(`${import.meta.env.BASE_URL}reset-password`, window.location.origin).toString(),
    })
    return error?.message ?? null
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) return isLocalPreviewEnabled && userId ? null : 'Open a valid invitation or password-reset link first.'
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) return error.message
      return await refreshPasswordSetup() ? null : 'Your password was saved, but access could not be verified. Please try again or sign in with your new password.'
    } catch { return 'Unable to save your password. Check your connection and try again.' }
  }, [userId, refreshPasswordSetup])

  const value = useMemo(
    () => ({ user, loading, passwordSetup, authError, refreshPasswordSetup, localPreviewMode: isLocalPreviewEnabled, previewEmail, signIn, signOut, requestPasswordReset, updatePassword }),
    [user, loading, passwordSetup, authError, refreshPasswordSetup, signIn, signOut, requestPasswordReset, updatePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
