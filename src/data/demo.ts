import type { Conversation, Message, StoredPage } from '../core/types'
import { savePages, getLibrary } from './database'

/** Fully fictional, deterministic data. Never reads or bundles the developer's exports. */
export async function loadDemo() {
  const specs: [string, string, number, 'instagram' | 'whatsapp'][] = [
    ['maya', 'Maya Chen', 9800, 'instagram'], ['leo', 'Leo', 5600, 'instagram'],
    ['weekend', 'Weekend people', 7200, 'instagram'], ['sofia', 'Sofia', 3600, 'whatsapp'],
    ['maya-alt', 'Maya · film account', 1700, 'instagram'], ['noah', 'Noah', 2150, 'instagram'],
    ['ella', 'Ella', 840, 'whatsapp'], ['studio', 'Studio friends', 1280, 'instagram'],
  ]
  let seed = 1987
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
  const snippets = ['See you there!', 'That sounds good to me', 'Coffee this weekend? ☕', 'hahaha 😂', 'I have a story for you', 'Sending you the photos later', 'Okay let’s do it!', 'Thank you 🤍', 'Made it home', 'This reminded me of you', 'Are we still on for tomorrow?', 'Yes! looking forward to it ✨']
  for (const [key, title, count, platform] of specs) {
    const id = `demo-${key}`, participants = ['Alex', title]
    if (key === 'weekend' || key === 'studio') participants.splice(1, 1, 'Maya Chen', 'Leo', 'Sofia', 'Noah')
    const messages: Message[] = []
    let timestamp = new Date(2026, 1, 1, 17, 0).getTime()
    for (let i = 0; i < count; i++) {
      if (i % 42 === 0) timestamp += (random() * 30 + 3) * 3_600_000
      else timestamp += Math.floor(random() ** 3 * 280_000) + 2000
      const sender = random() < .53 ? 'Alex' : participants[1 + Math.floor(random() * (participants.length - 1))]
      messages.push({ id: `${id}:${i}`, conversationId: id, timestamp, sender, text: snippets[Math.floor(random() * snippets.length)], kind: 'text' })
    }
    const metadata: Pick<Conversation, 'id' | 'title' | 'platform' | 'participants' | 'isDemo'> = { id, title, platform, participants, isDemo: true }
    const page: StoredPage = { id: `${id}/demo`, conversationId: id, source: 'demo', digest: 'demo-v1', messages }
    await savePages(metadata, [page])
  }
  return getLibrary()
}
