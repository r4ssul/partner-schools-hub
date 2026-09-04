import { useEffect, useId, useRef, useState } from 'react'
import { ArrowDown, LoaderCircle, LockKeyhole, MessageCircle, Send } from 'lucide-react'
import { useChat } from '../contexts/ChatContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { MAX_MESSAGE_LENGTH } from '../lib/chat'
import { dateKeyInTimeZone, formatDate, formatTime } from '../lib/date'
import { isLocalPreviewEnabled } from '../lib/runtime'
import { Avatar } from './Avatar'

export function TeamChat({ compact = false }: { compact?: boolean }) {
  const { data, currentUser } = useWorkspace()
  const { messages, loading, connected, error, unread, hasMore, loadingEarlier, send, markRead, loadEarlier, refresh } = useChat()
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const nearBottom = useRef(true)
  const requestId = useRef(crypto.randomUUID())
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const hintId = useId()
  const visibleMessages = compact ? messages.slice(-4) : messages
  const lastId = messages.at(-1)?.id || 0

  useEffect(() => {
    const markVisible = () => {
      if (!compact && nearBottom.current && document.visibilityState === 'visible') markRead(lastId)
    }
    if (nearBottom.current && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    markVisible()
    document.addEventListener('visibilitychange', markVisible)
    return () => document.removeEventListener('visibilitychange', markVisible)
  }, [lastId, compact, markRead])

  const jumpToLatest = () => {
    nearBottom.current = true; setAtBottom(true)
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    markRead(lastId)
  }
  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault()
    if (sending || !draft.trim()) return
    setSending(true); setSendError(null)
    try {
      await send(draft, requestId.current)
      requestId.current = crypto.randomUUID()
      setDraft('')
      nearBottom.current = true; setAtBottom(true)
      requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight })
      textareaRef.current?.focus()
    } catch (reason) { setSendError((reason as Error).message || 'Message not sent. Please try again.') }
    finally { setSending(false) }
  }
  const earlier = async () => {
    const viewport = scrollRef.current
    const oldHeight = viewport?.scrollHeight || 0
    const oldTop = viewport?.scrollTop || 0
    nearBottom.current = false
    await loadEarlier()
    requestAnimationFrame(() => { if (viewport) viewport.scrollTop = oldTop + viewport.scrollHeight - oldHeight })
  }

  return <div className={'team-chat ' + (compact ? 'team-chat--compact' : '')}>
    <div className="chat-room-meta"><span><LockKeyhole size={13} /> All workspace members</span><span className={connected ? 'chat-connection is-live' : 'chat-connection'}><i />{isLocalPreviewEnabled ? 'Local preview' : connected ? 'Live updates' : 'Connecting…'}</span></div>
    {error ? <div className="chat-error" role="alert">{error}<button className="text-button" onClick={refresh}>Retry</button></div> : null}
    <div className="chat-transcript" ref={scrollRef} role="log" aria-label="Team messages" aria-live="polite" aria-relevant="additions" tabIndex={0} onScroll={() => {
      const viewport = scrollRef.current
      if (!viewport) return
      const bottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 48
      nearBottom.current = bottom; setAtBottom(bottom)
      if (bottom && !compact && document.visibilityState === 'visible') markRead(lastId)
    }}>
      {!compact && hasMore ? <button className="chat-earlier text-button" onClick={() => void earlier()} disabled={loadingEarlier}>{loadingEarlier ? 'Loading…' : 'Load earlier messages'}</button> : null}
      {loading ? <div className="chat-empty" role="status"><LoaderCircle className="spin" size={24} /><span>Loading conversation…</span></div> : !visibleMessages.length ? <div className="chat-empty"><span className="chat-empty-icon"><MessageCircle size={27} /></span><strong>Your team’s conversation starts here</strong><p>Share a quick update, ask a question, or say hello.<br />Only members of this workspace can read it.</p></div> : visibleMessages.map((message, index) => {
        const member = data.members.find((person) => person.id === message.sender_id)
        const own = message.sender_id === currentUser.id
        const showDate = !index || dateKeyInTimeZone(message.created_at) !== dateKeyInTimeZone(visibleMessages[index - 1].created_at)
        return <div key={message.id} className="chat-message-group">
          {showDate && !compact ? <div className="chat-date"><span>{formatDate(message.created_at, { weekday: 'short', month: 'long', day: 'numeric' })}</span></div> : null}
          <article className={'chat-message ' + (own ? 'is-own' : '')} aria-label={(member?.name || 'Former member') + ' at ' + formatTime(message.created_at)}>
            {member ? <Avatar member={member} size="sm" /> : <span className="chat-former-avatar">?</span>}
            <div className="chat-message-content"><div className="chat-author"><strong>{own ? 'You' : member?.name || 'Former member'}</strong><time dateTime={message.created_at}>{formatTime(message.created_at)}</time></div><p className="chat-bubble">{message.body}</p>{!compact && !own && member?.organization ? <small className="chat-organisation">{member.organization}</small> : null}</div>
          </article>
        </div>
      })}
    </div>
    {!atBottom && !compact ? <button className="chat-latest button button--secondary button--small" onClick={jumpToLatest}><ArrowDown size={14} />{unread ? unread + ' new messages' : 'Jump to latest'}</button> : null}
    <form className="chat-composer" onSubmit={submit}>
      <label className="visually-hidden" htmlFor={hintId + '-input'}>Message your team</label>
      <div className="chat-composer-input"><textarea id={hintId + '-input'} ref={textareaRef} rows={compact ? 2 : 3} value={draft} maxLength={MAX_MESSAGE_LENGTH} placeholder="Message your team…" aria-describedby={hintId} readOnly={sending} onChange={(event) => { setDraft(event.target.value); setSendError(null); requestId.current = crypto.randomUUID() }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit() } }} /><button className="button button--primary chat-send" type="submit" aria-label={sending ? 'Sending message' : 'Send message'} disabled={sending || !draft.trim()}>{sending ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}{compact ? null : <span>Send</span>}</button></div>
      <div id={hintId} className="chat-composer-hint"><span>Enter to send · Shift + Enter for a new line</span><span>{draft.length ? draft.length + ' / ' + MAX_MESSAGE_LENGTH : 'Visible to the whole team'}</span></div>
      {sendError ? <p className="field-error" role="alert">{sendError} Your message has been kept.</p> : null}
    </form>
  </div>
}
