import type { Message, MessageKind, ParsedPage } from '../types'
import { isIgnoredSender, normalizeName, repairUnicode, stableId, validTimestamp } from '../normalize'

function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
export function instagramPath(path: string): { folder: string; source: string } | null {
  const clean = path.replace(/\\/g, '/').replace(/^\/+/, '')
  if (clean.split('/').some((part) => part === '..' || part === '__MACOSX')) return null
  const match = clean.match(/(?:^|\/)inbox\/([^/]+)\/(message_\d+\.json)$/i)
  if (match) return { folder: match[1], source: match[2] }
  if (/message_\d+\.json$/i.test(clean)) {
    const parts = clean.split('/')
    return { folder: parts.length > 1 ? parts.at(-2)! : '', source: parts.at(-1)! }
  }
  return null
}

export function parseInstagram(text: string, path: string): ParsedPage {
  let raw: unknown
  try { raw = JSON.parse(text.replace(/^\ufeff/, '')) } catch { throw new Error('Invalid JSON. Choose an Instagram JSON export, not an HTML export.') }
  if (!record(raw) || !Array.isArray(raw.messages)) throw new Error('This JSON does not contain an Instagram messages array.')
  const location = instagramPath(path)
  const thread = typeof raw.thread_path === 'string' ? raw.thread_path.split('/').filter(Boolean).at(-1) : ''
  const people = Array.isArray(raw.participants) ? raw.participants.filter(record).map((p) => normalizeName(p.name)).filter((p) => !isIgnoredSender(p)) : []
  const title = normalizeName(raw.title ?? people.find((p) => p !== 'Unknown') ?? 'Untitled conversation')
  const folder = thread || location?.folder || `${title}:${[...people].sort().join('|')}`
  const conversationId = `ig-${stableId(folder)}`
  const source = location?.source || path.split('/').at(-1) || 'message_1.json'
  const messages: Message[] = []
  let invalid = 0
  for (let i = 0; i < raw.messages.length; i++) {
    const value: unknown = raw.messages[i]
    if (!record(value)) { invalid++; continue }
    const sender = normalizeName(value.sender_name)
    if (isIgnoredSender(sender)) continue
    const kind: MessageKind = Array.isArray(value.photos) && value.photos.length ? 'photo'
      : Array.isArray(value.videos) && value.videos.length ? 'video'
        : Array.isArray(value.audio_files) && value.audio_files.length ? 'audio'
          : typeof value.call_duration === 'number' ? 'call'
            : record(value.share) ? 'link' : value.gifs || value.sticker ? 'attachment' : 'text'
    const content = typeof value.content === 'string' ? repairUnicode(value.content) : ''
    const link = record(value.share) && typeof value.share.link === 'string' ? value.share.link : ''
    messages.push({ id: `${conversationId}:${source}:${i}`, conversationId, sender, timestamp: validTimestamp(value.timestamp_ms), text: content || link, kind })
  }
  return { conversationId, title, platform: 'instagram', participants: [...new Set([...people, ...messages.map((m) => m.sender)])].sort(), messages, warnings: invalid ? [`Skipped ${invalid} malformed message records.`] : [] }
}
