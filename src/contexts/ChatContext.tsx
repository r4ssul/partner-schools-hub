/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { isLocalPreviewEnabled } from '../lib/runtime'
import { mergeMessages, validateMessage, type ChatMessage } from '../lib/chat'
import { useWorkspace } from './WorkspaceContext'

const PREVIEW_KEY = 'partner-schools-hub:chat:preview'
const PAGE_SIZE = 100
function previewMessages(): ChatMessage[] {
  try { return JSON.parse(localStorage.getItem(PREVIEW_KEY) || '[]') } catch { return [] }
}
interface ChatValue {
  messages: ChatMessage[]; loading: boolean; error: string | null; connected: boolean; unread: number; hasMore: boolean; loadingEarlier: boolean
  send: (body: string, clientId: string) => Promise<void>
  markRead: (id: number) => void
  loadEarlier: () => Promise<void>
  refresh: () => void
}
const ChatContext = createContext<ChatValue | null>(null)

export function ChatProvider({ children }: { children: ReactNode }) {
  const { workspaceId, currentUser } = useWorkspace()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [unread, setUnread] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingEarlier, setLoadingEarlier] = useState(false)
  const lastRead = useRef(0)
  const seen = useRef(new Set<number>())
  const historyComplete = useRef(false)
  const refreshRef = useRef<() => void>(() => {})
  const userId = currentUser.id

  useEffect(() => {
    let active = true
    const client = supabase
    const readKey = PREVIEW_KEY + ':read:' + userId
    const loadPreview = () => {
      const items = previewMessages()
      lastRead.current = Number(localStorage.getItem(readKey) || 0)
      setMessages(items); setUnread(items.filter((item) => item.id > lastRead.current && item.sender_id !== userId).length)
      setLoading(false)
    }
    if (!client && isLocalPreviewEnabled) {
      refreshRef.current = loadPreview
      loadPreview()
      window.addEventListener('storage', loadPreview)
      return () => window.removeEventListener('storage', loadPreview)
    }
    if (!client || !workspaceId) return
    let replicationReady = false
    const reload = async () => {
      try {
        const [result, readResult] = await Promise.all([
          client.from('chat_messages').select('*').eq('workspace_id', workspaceId).order('id', { ascending: false }).limit(PAGE_SIZE),
          client.from('chat_read_states').select('last_read_message_id').eq('workspace_id', workspaceId).eq('user_id', userId).maybeSingle(),
        ])
        if (result.error) throw result.error
        if (readResult.error) throw readResult.error
        if (!active) return
        lastRead.current = Math.max(lastRead.current, Number(readResult.data?.last_read_message_id || 0))
        const incoming = result.data as ChatMessage[]
        incoming.forEach((item) => seen.current.add(item.id))
        setMessages((previous) => mergeMessages(previous, incoming))
        if (incoming.length < PAGE_SIZE) historyComplete.current = true
        setHasMore(!historyComplete.current)
        const readAt = lastRead.current
        const countResult = await client.from('chat_messages').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).gt('id', readAt).or('sender_id.is.null,sender_id.neq.' + userId)
        if (countResult.error) throw countResult.error
        if (active) { if (readAt === lastRead.current) setUnread(countResult.count || 0); setError(null) }
      } catch (reason) { if (active) setError((reason as Error).message || 'Unable to load chat.') }
      finally { if (active) setLoading(false) }
    }
    refreshRef.current = () => { void reload() }
    void reload()
    const channel = client.channel('team-chat-' + workspaceId + '-' + userId)
      .on('system', {}, (payload) => {
        if (!active || payload.extension !== 'postgres_changes') return
        replicationReady = payload.status === 'ok'
        setConnected(replicationReady)
        // Socket join happens before database replication is ready. Close that
        // subscription gap with a fetch, including after reconnecting.
        if (replicationReady) void reload()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: 'workspace_id=eq.' + workspaceId }, (payload) => {
        if (!active) return
        const message = payload.new as ChatMessage
        if (!seen.current.has(message.id)) {
          seen.current.add(message.id)
          setMessages((previous) => mergeMessages(previous, [message]))
          if (message.sender_id !== userId && message.id > lastRead.current) setUnread((value) => value + 1)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages', filter: 'workspace_id=eq.' + workspaceId }, (payload) => {
        if (active) setMessages((previous) => mergeMessages(previous, [payload.new as ChatMessage]))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_read_states', filter: 'user_id=eq.' + userId }, () => { void reload() })
      .subscribe((status) => {
        if (!active) return
        if (status !== 'SUBSCRIBED') { replicationReady = false; setConnected(false) }
      })
    const onVisible = () => { if (document.visibilityState === 'visible') void reload() }
    const onOffline = () => setConnected(false)
    window.addEventListener('online', reload)
    window.addEventListener('offline', onOffline)
    document.addEventListener('visibilitychange', onVisible)
    const reconnectFallback = window.setInterval(() => {
      if (!replicationReady && document.visibilityState === 'visible') void reload()
    }, 15000)
    return () => {
      active = false
      window.clearInterval(reconnectFallback)
      void client.removeChannel(channel)
      window.removeEventListener('online', reload)
      window.removeEventListener('offline', onOffline)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [workspaceId, userId])

  const send = useCallback(async (body: string, clientId: string) => {
    const validationError = validateMessage(body)
    if (validationError) throw new Error(validationError)
    let message: ChatMessage
    if (supabase) {
      if (!workspaceId) throw new Error('Workspace is not ready.')
      const result = await supabase.rpc('send_chat_message', { target_workspace_id: workspaceId, message_body: body.trim(), request_id: clientId })
      if (result.error) throw new Error(result.error.message)
      message = result.data as ChatMessage
    } else {
      if (!isLocalPreviewEnabled) throw new Error('Chat is not configured.')
      const items = previewMessages()
      const existing = items.find((item) => item.client_id === clientId && item.sender_id === userId)
      message = existing || { id: Math.max(Date.now(), (items.at(-1)?.id || 0) + 1), workspace_id: 0, sender_id: userId, body: body.trim(), client_id: clientId, created_at: new Date().toISOString() }
      localStorage.setItem(PREVIEW_KEY, JSON.stringify(mergeMessages(items, [message])))
    }
    seen.current.add(message.id)
    setMessages((previous) => mergeMessages(previous, [message]))
    setError(null)
  }, [workspaceId, userId])

  const markRead = useCallback((id: number) => {
    if (!id || id <= lastRead.current) return
    const previousRead = lastRead.current
    lastRead.current = id
    setUnread(0)
    if (supabase && workspaceId) {
      void supabase.rpc('mark_chat_read', { target_workspace_id: workspaceId, message_id: id }).then(({ error: readError }) => {
        if (readError) { lastRead.current = previousRead; setError('Unable to save read status.'); refreshRef.current() }
      })
    } else if (isLocalPreviewEnabled) localStorage.setItem(PREVIEW_KEY + ':read:' + userId, String(id))
  }, [workspaceId, userId])

  const loadEarlier = useCallback(async () => {
    if (!supabase || !workspaceId || !messages.length || loadingEarlier) return
    setLoadingEarlier(true)
    try {
      const result = await supabase.from('chat_messages').select('*').eq('workspace_id', workspaceId).lt('id', messages[0].id).order('id', { ascending: false }).limit(PAGE_SIZE)
      if (result.error) throw result.error
      const incoming = result.data as ChatMessage[]
      incoming.forEach((item) => seen.current.add(item.id))
      if (incoming.length < PAGE_SIZE) historyComplete.current = true
      setMessages((previous) => mergeMessages(previous, incoming)); setHasMore(!historyComplete.current)
    } catch (reason) { setError((reason as Error).message || 'Unable to load earlier messages.') }
    finally { setLoadingEarlier(false) }
  }, [workspaceId, messages, loadingEarlier])
  const refresh = useCallback(() => refreshRef.current(), [])
  const value = useMemo(() => ({ messages, loading, error, connected, unread, hasMore, loadingEarlier, send, markRead, loadEarlier, refresh }), [messages, loading, error, connected, unread, hasMore, loadingEarlier, send, markRead, loadEarlier, refresh])
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

export function useChat() {
  const value = useContext(ChatContext)
  if (!value) throw new Error('useChat requires ChatProvider')
  return value
}
