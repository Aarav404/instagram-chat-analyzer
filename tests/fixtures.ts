import type { AnalysisRequest, Conversation, Message } from '../src/core/types'
import { EMPTY_FILTERS } from '../src/core/types'

export const baseTime = Date.UTC(2026, 0, 1, 12)
export function message(sender: string, seconds: number | null, conversationId = 'chat-a', text = 'hello there'): Message {
  return { id: `${conversationId}:${sender}:${seconds}`, conversationId, sender, timestamp: seconds === null ? null : baseTime + seconds * 1000, text, kind: 'text' }
}
export function conversation(id: string, messages: Message[], title = id): Conversation {
  const times = messages.flatMap((m) => m.timestamp === null ? [] : [m.timestamp])
  return { id, title, platform: 'instagram', participants: [...new Set(messages.map((m) => m.sender))], messageCount: messages.length, firstTimestamp: times.length ? Math.min(...times) : null, lastTimestamp: times.length ? Math.max(...times) : null, importedAt: 0, revision: 1 }
}
export function request(patch: Partial<AnalysisRequest> = {}): AnalysisRequest {
  return { conversationIds: ['chat-a'], filters: { ...EMPTY_FILTERS }, settings: { ownerNames: ['Me'], identityConfirmed: true, calculationMode: 'standard', shareMode: 'auto' }, ...patch }
}
export const legacyCases = [
  { name: 'alternating replies and trailing streak', messages: [message('Me', 0), message('Peer', 17), message('Me', 50), message('Me', 70), message('Peer', 86400), message('Me', 86430), message('Peer', 172800), message('Me', 172830)] },
  { name: 'session boundary drops pending doubles', messages: [message('Me', 0), message('Me', 1), message('Me', 2), message('Peer', 21603), message('Me', 21610), message('Me', 21611)] },
  { name: 'inclusive six-hour and seven-day bounds', messages: [message('Me', 0), message('Peer', 21600), message('Me', 43201), message('Peer', 64802), message('Me', 669602), message('Peer', 1274403)] },
  { name: 'sparse days and no within-session replies', messages: [message('Me', 0), message('Peer', 86400 * 2), message('Me', 86400 * 4), message('Peer', 86400 * 8), message('Me', 86400 * 12), message('Peer', 86400 * 16), message('Me', 86400 * 22), message('Peer', 86400 * 28)] },
  { name: 'equal timestamps and unsorted pages', messages: [message('Peer', 300), message('Me', 0), message('Peer', 0), message('Me', 20), message('Peer', 20), message('Me', 300)] },
  { name: 'custom group with owner aliases', groupName: 'Peer combined', owners: ['Me', 'Me WhatsApp'], messages: [message('Me', 0), message('Peer', 10), message('Me WhatsApp', 15, 'chat-b'), message('Peer alt', 22, 'chat-b'), message('Peer', 30), message('Me', 45)] },
  { name: 'native multi-account group', messages: [message('Me', 0), message('Peer', 30), message('Third', 60), message('Fourth', 100), message('Fifth', 170), message('Me', 200)] },
  { name: 'single sender', messages: [message('Me', 0), message('Me', 10), message('Me', 30)] },
]
