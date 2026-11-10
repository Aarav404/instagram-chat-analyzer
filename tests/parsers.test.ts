import { describe, expect, it } from 'vitest'
import { instagramPath, parseInstagram } from '../src/core/parsers/instagram'
import { parseWhatsApp } from '../src/core/parsers/whatsapp'
import { isIgnoredSender, repairUnicode } from '../src/core/normalize'

describe('Instagram exports', () => {
  const raw = { title: 'A friend', participants: [{ name: 'Me' }, { name: 'Peer' }, { name: 'Meta AI' }], messages: [{ sender_name: 'Me', timestamp_ms: 1700000000000, content: 'hello' }, { sender_name: 'Peer', photos: [{ uri: 'private/photo.jpg' }] }, { sender_name: 'Meta AI', timestamp_ms: 1 }], thread_path: 'inbox/friend_123' }
  it('handles root, nested, and folder paths', () => { for (const path of ['inbox/person/message_1.json', 'root/your_instagram_activity/messages/inbox/person/message_1.json']) expect(instagramPath(path)?.folder).toBe('person'); expect(instagramPath('../inbox/person/message_1.json')).toBeNull() })
  it('normalizes supported messages while excluding Meta AI', () => { const parsed = parseInstagram(JSON.stringify(raw), 'message_1.json'); expect(parsed.messages).toHaveLength(2); expect(parsed.participants).toEqual(['Me', 'Peer']); expect(parsed.messages[1]).toMatchObject({ timestamp: null, kind: 'photo', text: '' }) })
  it('uses stable thread identity across pages, preserving identical legitimate messages', () => { const a = parseInstagram(JSON.stringify(raw), 'message_1.json'), b = parseInstagram(JSON.stringify(raw), 'message_2.json'); expect(a.conversationId).toBe(b.conversationId); expect(a.messages[0].id).not.toBe(b.messages[0].id) })
  it('does not merge unrelated folders with the same title', () => { const a = parseInstagram(JSON.stringify({ ...raw, thread_path: undefined }), 'inbox/a/message_1.json'), b = parseInstagram(JSON.stringify({ ...raw, thread_path: undefined }), 'inbox/b/message_1.json'); expect(a.conversationId).not.toBe(b.conversationId) })
  it('rejects corrupt and unsupported input', () => { expect(() => parseInstagram('{bad', 'message_1.json')).toThrow('Invalid JSON'); expect(() => parseInstagram('{}', 'message_1.json')).toThrow('messages array') })
  it('repairs escaped UTF-8 without corrupting real Unicode', () => { expect(repairUnicode('FranÃ§ais')).toBe('Français'); expect(repairUnicode('café')).toBe('café'); expect(repairUnicode('hello 👋 नमस्ते')).toBe('hello 👋 नमस्ते'); expect(isIgnoredSender('MeTa AI')).toBe(true) })
})
describe('WhatsApp exports', () => {
  it('reads iOS 12-hour timestamps, BOM, narrow spaces and multiline text', () => {
    const parsed = parseWhatsApp('\ufeff[14/02/26, 7:26:35\u202fPM] Me: Hello\nsecond line\n[14/02/26, 7:27:00 PM] Peer: Hi', 'WhatsApp Chat with Peer.txt')
    expect(parsed.messages).toHaveLength(2); expect(parsed.messages[0].text).toBe('Hello\nsecond line'); expect(new Date(parsed.messages[0].timestamp!).getHours()).toBe(19); expect(parsed.title).toBe('Peer')
  })
  it('reads Android 24-hour clocks and skips notices', () => {
    const parsed = parseWhatsApp('14/02/2026, 19:26 - Messages are encrypted\n14/02/2026, 19:27 - Me: hi\n14/02/2026, 19:28 - Peer: hello\n14/02/2026, 19:29 - Someone joined\n14/02/2026, 19:30 - Meta AI: unwanted', 'chat.txt')
    expect(parsed.messages).toHaveLength(2); expect(parsed.messages[1].text).toBe('hello')
  })
  it('honors US dates and rejects invalid calendar dates without duplication', () => {
    const parsed = parseWhatsApp('[12/31/2026, 12:00 AM] Me: midnight\n[02/31/2026, 1:00 AM] Peer: bad\n[12/31/2026, 12:00 PM] Peer: noon', 'chat.txt', { dateOrder: 'MDY' })
    expect(parsed.messages).toHaveLength(2); expect(new Date(parsed.messages[0].timestamp!).getHours()).toBe(0); expect(new Date(parsed.messages[1].timestamp!).getHours()).toBe(12); expect(parsed.warnings).toHaveLength(1)
  })
  it('handles Unicode names, omitted media and colon-containing messages', () => {
    const parsed = parseWhatsApp('[1/2/26, 13:00] Zoë: <Media omitted>\n[1/2/26, 13:01] 李: time: now', '_chat.txt')
    expect(parsed.participants).toContain('李'); expect(parsed.messages[0].kind).toBe('attachment'); expect(parsed.messages[1].text).toBe('time: now')
  })
  it('reports empty files', () => expect(() => parseWhatsApp('no messages', 'chat.txt')).toThrow('No WhatsApp messages'))
})
