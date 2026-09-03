export const MAX_MESSAGE_LENGTH = 2000
export interface ChatMessage { id: number; workspace_id: number; sender_id: string; body: string; client_id: string; created_at: string }
export function validateMessage(body: string) {
  if (!body.trim()) return 'Write a message before sending.'
  if (body.trim().length > MAX_MESSAGE_LENGTH) return 'Keep messages to 2,000 characters or fewer.'
  return null
}
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]))
  incoming.forEach((message) => byId.set(message.id, message))
  return [...byId.values()].sort((a, b) => a.id - b.id)
}
