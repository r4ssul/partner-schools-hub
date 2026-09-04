import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useState } from 'react'

const mock = vi.hoisted(() => ({
  rpc: vi.fn(), getSession: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
}))
vi.mock('../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: mock.rpc, auth: mock } }))
vi.mock('../lib/runtime', () => ({ isLocalPreviewEnabled: false }))
import { AuthProvider, useAuth } from './AuthContext'

function Probe() {
  const { user, loading, passwordSetup, updatePassword, signOut } = useAuth()
  const [result, setResult] = useState('')
  return <><p>{loading ? 'Loading' : !user ? 'Signed out' : passwordSetup}</p><button onClick={async () => setResult((await updatePassword('A-long-test-password')) || 'Saved')}>Save</button><button onClick={() => void signOut()}>Cancel</button><output>{result}</output></>
}
beforeEach(() => {
  vi.clearAllMocks()
  mock.getSession.mockResolvedValue({ data: { session: { user: { id: 'invited-user', email: 'qa@example.invalid' } } }, error: null })
  mock.rpc.mockResolvedValue({ data: false, error: null })
  mock.updateUser.mockResolvedValue({ error: null })
  mock.signOut.mockResolvedValue({ error: null })
})
afterEach(cleanup)

describe('invitation password setup', () => {
  it('does not equate an authenticated invitation session with completed setup', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('required')
    expect(screen.queryByText('complete')).not.toBeInTheDocument()
    expect(mock.rpc).toHaveBeenCalledWith('has_completed_password_setup')
  })
  it('fails closed when server verification fails', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { message: 'Offline' } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('error')
    expect(screen.queryByText('complete')).not.toBeInTheDocument()
  })
  it('requires server confirmation after a successful password update', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('required')
    mock.rpc.mockResolvedValue({ data: true, error: null })
    fireEvent.click(screen.getByText('Save'))
    await screen.findByText('Saved')
    await screen.findByText('complete')
    expect(mock.updateUser).toHaveBeenCalledWith({ password: 'A-long-test-password' })
  })
  it('keeps setup locked when the password update fails', async () => {
    mock.updateUser.mockResolvedValue({ error: { message: 'Password rejected' } })
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('required')
    fireEvent.click(screen.getByText('Save'))
    await screen.findByText('Password rejected')
    expect(screen.getByText('required')).toBeInTheDocument()
  })
  it('cancel clears the invitation session on this device', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    await screen.findByText('required')
    fireEvent.click(screen.getByText('Cancel'))
    await screen.findByText('Signed out')
    await waitFor(() => expect(mock.signOut).toHaveBeenCalledWith({ scope: 'local' }))
  })
})
