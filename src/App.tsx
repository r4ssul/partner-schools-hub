import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { useAuth } from './contexts/AuthContext'
import { WorkspaceProvider, useWorkspace } from './contexts/WorkspaceContext'
import { canManageMembership, canViewAuditLog } from './lib/policies'
import { ChatProvider } from './contexts/ChatContext'

const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const FilesPage = lazy(() => import('./pages/FilesPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const MeetingsPage = lazy(() => import('./pages/MeetingsPage'))
const TasksPage = lazy(() => import('./pages/TasksPage'))
const LinksPage = lazy(() => import('./pages/LinksPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const UsersPage = lazy(() => import('./pages/UsersPage'))
const TrashPage = lazy(() => import('./pages/TrashPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const AuditPage = lazy(() => import('./pages/AuditPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'))

function LoadingScreen() {
  return <div className="loading-screen" role="status"><img src={`${import.meta.env.BASE_URL}assets/partner-schools-hub-mark.png`} alt="" /><span>Loading Partner Schools Hub…</span></div>
}

function WorkspaceApp() {
  const { loading, error } = useWorkspace()
  const { signOut } = useAuth()
  if (loading) return <LoadingScreen />
  if (error) return <div className="loading-screen"><h1>Workspace unavailable</h1><p role="alert">{error}</p><button className="button button--primary" onClick={() => window.location.reload()}>Try again</button><button className="text-button" onClick={() => void signOut()}>Sign out</button></div>
  return <ChatProvider><AppShell /></ChatProvider>
}

function ProtectedApp() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return <WorkspaceProvider><WorkspaceApp /></WorkspaceProvider>
}

function ManagerRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useWorkspace()
  return canManageMembership(currentUser.role) ? children : <Navigate to="/" replace />
}

function AuditRoute({ children }: { children: React.ReactNode }) {
  const { currentUser } = useWorkspace()
  return canViewAuditLog(currentUser.role) ? children : <Navigate to="/" replace />
}

function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accept-invite" element={<ResetPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedApp />}>
          <Route index element={<DashboardPage />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="meetings" element={<MeetingsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="links" element={<LinksPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="trash" element={<TrashPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="admin/users" element={<ManagerRoute><UsersPage /></ManagerRoute>} />
          <Route path="admin/audit" element={<AuditRoute><AuditPage /></AuditRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
