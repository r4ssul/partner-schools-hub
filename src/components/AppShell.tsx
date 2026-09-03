import { useCallback, useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Activity, Bell, CalendarDays, CheckSquare2, ChevronDown, FileText, Home, Link2, LogOut, Menu, Plus, Search, Settings, Trash2, UserCog, UsersRound, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import type { EntityKind } from '../types'
import { AddItemDialog } from './AddItemDialog'
import { Avatar } from './Avatar'
import { Brand } from './Brand'

const navItems = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/files', label: 'Files', icon: FileText },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/meetings', label: 'Meetings', icon: UsersRound },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare2 },
  { to: '/links', label: 'Links', icon: Link2 },
]

const addKinds: Array<{ kind: EntityKind; label: string }> = [
  { kind: 'file', label: 'Upload file' }, { kind: 'folder', label: 'New folder' }, { kind: 'event', label: 'New event' },
  { kind: 'meeting', label: 'New meeting' }, { kind: 'task', label: 'New task' }, { kind: 'link', label: 'New link' },
]

export function AppShell() {
  const { signOut } = useAuth()
  const { currentUser, data, markNotificationRead, error } = useWorkspace()
  const navigate = useNavigate()
  const [addOpen, setAddOpen] = useState(false)
  const [addKind, setAddKind] = useState<EntityKind>('task')
  const [addSourceMeetingId, setAddSourceMeetingId] = useState<string | null>(null)
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const unread = data.notifications.filter((notification) => !notification.readAt)
  const closeMenus = useCallback(() => {
    setMobileMenu(false)
    setAddMenuOpen(false)
    setNotificationsOpen(false)
    setUserOpen(false)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        closeMenus()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') {
        closeMenus()
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeMenus])
  useEffect(() => { if (searchOpen) searchRef.current?.focus() }, [searchOpen])

  const openCreate = (kind: EntityKind, sourceMeetingId: string | null = null) => { setAddKind(kind); setAddSourceMeetingId(sourceMeetingId); setAddOpen(true); setAddMenuOpen(false) }
  const searchItems = [
    ...data.documents.filter((item) => !item.deletedAt).map((item) => ({ label: item.name, meta: 'File', to: '/files' })),
    ...data.events.filter((item) => !item.deletedAt).map((item) => ({ label: item.title, meta: 'Event', to: '/calendar' })),
    ...data.meetings.filter((item) => !item.deletedAt).map((item) => ({ label: item.title, meta: 'Meeting', to: '/meetings' })),
    ...data.tasks.filter((item) => !item.deletedAt).map((item) => ({ label: item.title, meta: 'Task', to: '/tasks' })),
    ...data.links.filter((item) => !item.deletedAt).map((item) => ({ label: item.title, meta: 'Link', to: '/links' })),
  ]
  const [query, setQuery] = useState('')
  const results = query.trim().length > 1 ? searchItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : []

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <Brand />
        <div className="topbar__actions">
          <button className="topbar-search" onClick={() => { closeMenus(); setSearchOpen(true) }} aria-label="Search Partner Schools Hub" aria-keyshortcuts="Meta+K Control+K"><Search size={17} /><span>Search</span><kbd>⌘ K</kbd></button>
          <div className="menu-anchor">
            <button className="button button--topbar" data-global-add-trigger onClick={() => { setAddMenuOpen((value) => !value); setNotificationsOpen(false); setUserOpen(false) }} aria-expanded={addMenuOpen} aria-haspopup="menu"><Plus size={19} /> Add new <ChevronDown size={16} /></button>
            {addMenuOpen ? <div className="dropdown dropdown--add" role="menu">{addKinds.map((item) => <button role="menuitem" key={item.kind} onClick={() => openCreate(item.kind)}>{item.label}</button>)}</div> : null}
          </div>
          <div className="menu-anchor">
            <button className="icon-button icon-button--inverse" onClick={() => { setNotificationsOpen((value) => !value); setAddMenuOpen(false); setUserOpen(false) }} aria-label={`${unread.length} unread notifications`} aria-expanded={notificationsOpen} aria-haspopup="menu"><Bell size={21} />{unread.length ? <span className="notification-count">{unread.length}</span> : null}</button>
            {notificationsOpen ? <div className="dropdown notification-menu"><div className="dropdown__heading"><strong>Notifications</strong><span>{unread.length} unread</span></div>{data.notifications.length ? data.notifications.slice(0, 6).map((notification) => <button key={notification.id} className={notification.readAt ? 'notification-item' : 'notification-item is-unread'} onClick={() => void markNotificationRead(notification.id)}><strong>{notification.title}</strong><span>{notification.body}</span></button>) : <p className="empty-copy">You’re all caught up.</p>}</div> : null}
          </div>
          <div className="menu-anchor user-anchor">
            <button className="user-button" onClick={() => { setUserOpen((value) => !value); setAddMenuOpen(false); setNotificationsOpen(false) }} aria-expanded={userOpen} aria-haspopup="menu"><Avatar member={currentUser} /><span><strong>{currentUser.name}</strong><small>{currentUser.role === 'owner' ? 'Super Admin' : 'Admin'}</small></span><ChevronDown size={16} /></button>
            {userOpen ? <div className="dropdown user-menu" role="menu"><button role="menuitem" onClick={() => { navigate('/settings'); setUserOpen(false) }}><Settings size={17} />Account settings</button>{currentUser.role === 'owner' ? <><button role="menuitem" onClick={() => { navigate('/admin/users'); setUserOpen(false) }}><UserCog size={17} />Manage users</button><button role="menuitem" onClick={() => { navigate('/admin/audit'); setUserOpen(false) }}><Activity size={17} />Audit log</button></> : null}<button role="menuitem" onClick={() => { navigate('/trash'); setUserOpen(false) }}><Trash2 size={17} />Trash</button><button role="menuitem" onClick={() => void signOut()}><LogOut size={17} />Sign out</button></div> : null}
          </div>
          <button className="icon-button icon-button--inverse mobile-menu-button" onClick={() => setMobileMenu((value) => !value)} aria-label="Open navigation">{mobileMenu ? <X /> : <Menu />}</button>
        </div>
      </header>
      <nav className={mobileMenu ? 'primary-nav is-open' : 'primary-nav'} aria-label="Primary navigation">
        {navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={closeMenus}><Icon size={20} strokeWidth={1.8} /><span>{label}</span></NavLink>)}
      </nav>
      {error ? <div className="environment-banner" role="status">Unable to reach the shared workspace. Showing the last local snapshot. {error}</div> : null}
      <main id="main-content" tabIndex={-1}><Outlet context={{ openCreate }} /></main>
      <footer className="site-footer"><span>© {new Date().getFullYear()} Partner Schools Hub</span><span>Private workspace · Asia/Tokyo</span><button onClick={() => navigate('/settings')}>Security & settings</button></footer>
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">{navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'}><Icon size={22} /><span>{label}</span></NavLink>)}</nav>
      {addOpen ? <AddItemDialog key={`${addKind}-${addSourceMeetingId ?? 'general'}`} open initialKind={addKind} sourceMeetingId={addSourceMeetingId} onClose={() => { setAddOpen(false); setAddSourceMeetingId(null) }} /> : null}
      {searchOpen ? <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search Partner Schools Hub" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false) }}><div className="search-dialog"><div className="search-input"><Search size={20} /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search files, events, meetings, tasks and links…" aria-label="Search all workspace content" /><button className="icon-button" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={19} /></button></div><div className="search-results" aria-live="polite">{query.length < 2 ? <p>Type at least two characters to search.</p> : results.length ? results.map((item, index) => <button key={`${item.meta}-${item.label}-${index}`} onClick={() => { navigate(item.to); setSearchOpen(false); setQuery('') }}><span>{item.label}</span><small>{item.meta}</small></button>) : <p>No results found.</p>}</div></div></div> : null}
    </div>
  )
}
