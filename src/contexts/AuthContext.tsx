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

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setUser(mapSession(data.session))
        setLoading(false)
      }
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(mapSession(session))
      setLoading(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
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
    if (supabase) await supabase.auth.signOut()
    sessionStorage.removeItem(LOCAL_SESSION_KEY)
    setUser(null)
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!supabase) return isLocalPreviewEnabled ? 'Password recovery is unavailable in showcase mode.' : 'Password recovery is unavailable until Supabase is configured.'
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: new URL(`${import.meta.env.BASE_URL}reset-password`, window.location.origin).toString(),
    })
    return error?.message ?? null
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    if (!supabase) return isLocalPreviewEnabled ? null : 'Password updates are unavailable until Supabase is configured.'
    const { error } = await supabase.auth.updateUser({ password })
    return error?.message ?? null
  }, [])

  const value = useMemo(
    () => ({ user, loading, localPreviewMode: isLocalPreviewEnabled, previewEmail, signIn, signOut, requestPasswordReset, updatePassword }),
    [user, loading, signIn, signOut, requestPasswordReset, updatePassword],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
