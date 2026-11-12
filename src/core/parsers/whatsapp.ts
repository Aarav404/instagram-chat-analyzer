import type { ImportOptions, Message, ParsedPage } from '../types'
import { isIgnoredSender, normalizeName, stableId } from '../normalize'
import { isGenericWhatsAppTitle } from '../conversation-title'

const prefix = /^(?:\[)?(\d{1,4}[/.\-]\d{1,2}[/.\-]\d{1,4}),?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]\.?m\.?)?(?:\]\s*|\s+-\s+)(.*)$/i
function parseTime(date: string, hour: string, minute: string, second: string | undefined, period: string | undefined, order: ImportOptions['dateOrder']): number | null {
  const pieces = date.split(/[/.\-]/).map(Number)
  let [day, month, year] = pieces
  if (date.split(/[/.\-]/)[0].length === 4) [year, month, day] = pieces
  else if (order === 'MDY') [month, day, year] = pieces
  if (year < 100) year += year <= 68 ? 2000 : 1900
  let h = Number(hour)
  if (period) { if (h < 1 || h > 12) return null; h = h % 12 + (/^p/i.test(period) ? 12 : 0) }
  const m = Number(minute), s = Number(second || 0)
  if (h > 23 || m > 59 || s > 59 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const parsed = new Date(year, month - 1, day, h, m, s)
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null
  return parsed.getTime()
}

export function parseWhatsApp(text: string, filename: string, options: ImportOptions = { dateOrder: 'DMY' }): ParsedPage {
  const basename = filename.split('/').at(-1)!.replace(/\.txt$/i, '')
  const namedExport = /^WhatsApp Chat (?:with|-)\s*\S/i.test(basename)
  const exportTitle = basename.replace(/^WhatsApp Chat (?:with|-)\s*/i, '').replace(/^_chat$/, 'WhatsApp conversation')
  const lines = text.replace(/^\ufeff/, '').split(/\r?\n/)
  const pending: Omit<Message, 'id' | 'conversationId'>[] = []
  let current: Omit<Message, 'id' | 'conversationId'> | null = null
  let invalid = 0
  for (const original of lines) {
    const line = original.replace(/[\u200e\u200f\u202a-\u202e\ufeff]/g, '').replace(/[\u202f\u00a0]/g, ' ')
    const match = prefix.exec(line)
    if (match) {
      if (current) pending.push(current)
      current = null
      const [, date, hour, minute, second, period, rest] = match
      const senderMatch = /^(.+?):\s?(.*)$/.exec(rest)
      if (!senderMatch) continue // encryption notices, joins, removals and other system events
      const sender = normalizeName(senderMatch[1])
      if (isIgnoredSender(sender)) continue
      const timestamp = parseTime(date, hour, minute, second, period, options.dateOrder)
      if (timestamp === null) { invalid++; continue }
      const body = senderMatch[2].trim()
      current = { sender, timestamp, text: body, kind: /(?:omitted|file attached|\(attached\))/i.test(body) ? 'attachment' : /https?:\/\//i.test(body) ? 'link' : 'text' }
    } else if (current && line.trim()) current.text += '\n' + original
  }
  if (current) pending.push(current)
  if (!pending.length) throw new Error('No WhatsApp messages found. Use Export chat → Without media, and check the day/month order.')
  const participants = [...new Set(pending.map((m) => m.sender))].sort()
  const titleSource = !namedExport && isGenericWhatsAppTitle(exportTitle) ? 'participants' : 'export'
  const title = titleSource === 'participants' ? participants.join(', ') : exportTitle
  // Preserve existing import IDs: display names and account selection must not
  // create duplicate conversations or break saved groups when reimporting.
  const conversationId = `wa-${stableId(`${exportTitle}:${participants.join('|')}`)}`
  return { conversationId, title, titleSource, platform: 'whatsapp', participants, messages: pending.map((m, i) => ({ ...m, conversationId, id: `${conversationId}:${i}` })), warnings: invalid ? [`Skipped ${invalid} messages with invalid dates. Check the selected date format.`] : [] }
}
