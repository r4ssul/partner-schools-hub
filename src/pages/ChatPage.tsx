import { LockKeyhole, MessageCircle, UsersRound } from 'lucide-react'
import { TeamChat } from '../components/TeamChat'
import { Avatar } from '../components/Avatar'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { memberRoleLabel } from '../lib/policies'

export default function ChatPage() {
  const { data, currentUser } = useWorkspace()
  const members = data.members.filter((member) => member.active)
  return <div className="page feature-page chat-page">
    <div className="page-heading"><div><h1>Team chat</h1><p>A shared space for quick questions, updates, and conversations.</p></div><span className="chat-private-label"><LockKeyhole size={15} /> Private workspace</span></div>
    <div className="chat-page-layout">
      <section className="content-surface chat-main" aria-label="Shared conversation"><div className="surface-toolbar"><div><h2><MessageCircle size={20} /> General</h2><span>{members.length} members · One connected team</span></div></div><TeamChat /></section>
      <aside className="content-surface chat-team"><h2><UsersRound size={19} /> In this conversation</h2><p>Everyone in the workspace can join in.</p>{members.map((member) => <div className="chat-team-member" key={member.id}><Avatar member={member} size="sm" /><div><strong>{member.name}{member.id === currentUser.id ? ' (you)' : ''}</strong><span>{member.organization}</span><small>{memberRoleLabel(member.role, member.email)}</small></div></div>)}<div className="chat-team-note"><LockKeyhole size={18} /><p>Messages are saved securely for your team. Use Files to share documents and Tasks for follow-ups.</p></div></aside>
    </div>
  </div>
}
